-- 00256: Saga KvK — alle RPCs für Tier S + Tier A + Tier B
--
-- Inhalt:
--   Helpers:    _saga_guardian_battle_mult, _saga_user_buff_mult, _saga_holy_buff_mult,
--               _saga_diplomacy_blocks_attack, _saga_decrement_ap
--   Wächter:    Battle-Resolution nutzt Wächter-Skills + Klassen-Buffs
--   PvP:        saga_attack_user (User vs User direkt)
--   Rally:      saga_start_rally, saga_join_rally, saga_cancel_rally
--   Reinforce:  saga_send_reinforcement
--   Gather:     saga_start_gather, saga_collect_gather
--   Holy:       (capture läuft via attack auf is_holy_site=true Zone)
--   Migrate:    saga_use_migration_item
--   Buffs:      saga_use_buff_item
--   NAP:        saga_propose_nap, saga_accept_nap, saga_break_nap
--   Behemoth:   saga_attack_behemoth
--   Resolve:    saga_resolve_arrived_marches NEU (mit allen kinds + buffs + augur)
--   Cron:       saga_holy_tick (rewards für hold_seconds), saga_buff_tick (expire)

-- ════════════════════════════════════════════════════════════════
-- HELPER: Wächter-Battle-Multiplier
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_guardian_battle_mult(p_guardian_id uuid)
returns numeric language plpgsql stable as $$
declare
  v_level int;
  v_atk_buff numeric := 1.0;
begin
  if p_guardian_id is null then return 1.0; end if;
  select coalesce(level, 1) into v_level from public.user_guardians where id = p_guardian_id;
  -- Vereinfacht: jeder Level gibt +2% Atk
  v_atk_buff := 1.0 + (v_level * 0.02);
  -- Klassen-Bonus könnten wir hier auch reinholen, vereinfacht für Phase 1
  return v_atk_buff;
end $$;

-- ════════════════════════════════════════════════════════════════
-- HELPER: User-Buff-Multiplier (aktive Buffs aus saga_active_buffs)
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_user_buff_mult(p_user_id uuid, p_bracket_id uuid, p_buff_kind_prefix text)
returns numeric language sql stable as $$
  select coalesce(max(multiplier), 1.0)
    from public.saga_active_buffs
   where user_id = p_user_id
     and bracket_id = p_bracket_id
     and buff_kind like p_buff_kind_prefix || '%'
     and expires_at > now()
$$;

-- ════════════════════════════════════════════════════════════════
-- HELPER: Holy-Site-Crew-Buff
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_holy_buff_mult(p_bracket_id uuid, p_crew_id uuid, p_buff_kind text)
returns numeric language sql stable as $$
  select coalesce(1.0 + sum(z.holy_buff_pct)::numeric / 100.0, 1.0)
    from public.saga_holy_holders h
    join public.saga_zones z on z.id = h.zone_id
   where h.bracket_id = p_bracket_id
     and h.crew_id = p_crew_id
     and z.is_holy_site = true
     and z.holy_buff_kind = p_buff_kind
$$;

-- ════════════════════════════════════════════════════════════════
-- HELPER: NAP-Block zwischen Crews
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_diplomacy_blocks_attack(p_bracket_id uuid, p_attacker uuid, p_defender uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.saga_diplomacy
     where bracket_id = p_bracket_id
       and status = 'active'
       and pact_kind in ('nap','alliance')
       and ((crew_a = p_attacker and crew_b = p_defender)
         or (crew_a = p_defender and crew_b = p_attacker))
       and (expires_at is null or expires_at > now())
  )
$$;

-- ════════════════════════════════════════════════════════════════
-- HELPER: Action-Points abziehen
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_decrement_ap(p_user_id uuid, p_cost int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_remaining int;
begin
  select action_points into v_remaining from public.saga_user_state where user_id = p_user_id;
  if v_remaining is null or v_remaining < p_cost then return false; end if;
  update public.saga_user_state
     set action_points = action_points - p_cost,
         updated_at = now()
   where user_id = p_user_id;
  return true;
end $$;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_attack_user (Solo-PvP)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_attack_user(
  p_target_user_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
) returns table (ok boolean, message text, march_id uuid, arrives_in_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_target_pos public.saga_user_positions%rowtype;
  v_my_pos public.saga_user_positions%rowtype;
  v_target_crew uuid;
  v_state public.saga_user_state%rowtype;
  v_seconds int;
  v_arrives timestamptz;
  v_new_id uuid;
  v_total int;
  v_shield_until timestamptz;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid, 0; return; end if;
  if v_user = p_target_user_id then return query select false, 'cannot_attack_self', null::uuid, 0; return; end if;
  v_total := coalesce(p_inf,0)+coalesce(p_cav,0)+coalesce(p_mark,0)+coalesce(p_werk,0);
  if v_total <= 0 then return query select false, 'no_troops', null::uuid, 0; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid, 0; return; end if;

  select * into v_target_pos from public.saga_user_positions where user_id = p_target_user_id;
  if v_target_pos.user_id is null or v_target_pos.current_zone_id is null then
    return query select false, 'target_not_on_map', null::uuid, 0; return;
  end if;

  select * into v_my_pos from public.saga_user_positions where user_id = v_user;
  if v_my_pos.user_id is null or v_my_pos.current_zone_id is null then
    return query select false, 'self_not_on_map', null::uuid, 0; return;
  end if;
  if v_my_pos.bracket_id != v_target_pos.bracket_id then
    return query select false, 'cross_bracket', null::uuid, 0; return;
  end if;

  -- Shield prüfen
  select expires_at into v_shield_until from public.saga_user_shields
   where user_id = p_target_user_id and bracket_id = v_target_pos.bracket_id;
  if v_shield_until is not null and v_shield_until > now() then
    return query select false, 'target_shielded', null::uuid, 0; return;
  end if;

  -- NAP prüfen
  select crew_id into v_target_crew from public.crew_members where user_id = p_target_user_id limit 1;
  if v_crew_id = v_target_crew then return query select false, 'same_crew', null::uuid, 0; return; end if;
  if v_target_crew is not null and public._saga_diplomacy_blocks_attack(v_target_pos.bracket_id, v_crew_id, v_target_crew) then
    return query select false, 'nap_active', null::uuid, 0; return;
  end if;

  -- Action-Points + PvP-Daily-Cap
  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.pvp_attacks_today >= v_state.pvp_attacks_max then
    return query select false, 'pvp_daily_cap', null::uuid, 0; return;
  end if;
  if v_state.march_slots_used >= v_state.march_slots_total then
    return query select false, 'no_march_slots', null::uuid, 0; return;
  end if;
  if not public._saga_decrement_ap(v_user, 5) then
    return query select false, 'no_action_points', null::uuid, 0; return;
  end if;

  v_seconds := public._saga_calc_march_seconds(v_my_pos.current_zone_id, v_target_pos.current_zone_id);
  v_arrives := now() + (v_seconds || ' seconds')::interval;

  insert into public.saga_marches (
    bracket_id, crew_id, user_id, origin_zone_id, target_zone_id, target_user_id,
    march_kind, inf, cav, mark, werk, guardian_id, arrives_at
  ) values (
    v_my_pos.bracket_id, v_crew_id, v_user, v_my_pos.current_zone_id, v_target_pos.current_zone_id, p_target_user_id,
    'attack_user', p_inf, p_cav, p_mark, p_werk, p_guardian_id, v_arrives
  ) returning id into v_new_id;

  update public.saga_user_state
     set march_slots_used = march_slots_used + 1,
         pvp_attacks_today = pvp_attacks_today + 1,
         saga_slot_inf = saga_slot_inf + p_inf,
         saga_slot_cav = saga_slot_cav + p_cav,
         saga_slot_mark = saga_slot_mark + p_mark,
         saga_slot_werk = saga_slot_werk + p_werk,
         updated_at = now()
   where user_id = v_user;

  return query select true, 'attacking_user', v_new_id, v_seconds;
end $$;
grant execute on function public.saga_attack_user(uuid, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_send_reinforcement (Defender reagiert auf incoming attack)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_send_reinforcement(
  p_target_zone_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
) returns table (ok boolean, message text, march_id uuid, arrives_in_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_my_pos public.saga_user_positions%rowtype;
  v_target public.saga_zones%rowtype;
  v_state public.saga_user_state%rowtype;
  v_seconds int;
  v_arrives timestamptz;
  v_new_id uuid;
  v_total int;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid, 0; return; end if;
  v_total := coalesce(p_inf,0)+coalesce(p_cav,0)+coalesce(p_mark,0)+coalesce(p_werk,0);
  if v_total <= 0 then return query select false, 'no_troops', null::uuid, 0; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid, 0; return; end if;

  select * into v_target from public.saga_zones where id = p_target_zone_id;
  if v_target.id is null then return query select false, 'zone_not_found', null::uuid, 0; return; end if;
  if v_target.owner_crew_id != v_crew_id then
    return query select false, 'not_own_zone', null::uuid, 0; return;
  end if;

  select * into v_my_pos from public.saga_user_positions where user_id = v_user;
  if v_my_pos.user_id is null then return query select false, 'self_not_on_map', null::uuid, 0; return; end if;

  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.march_slots_used >= v_state.march_slots_total then
    return query select false, 'no_march_slots', null::uuid, 0; return;
  end if;

  v_seconds := public._saga_calc_march_seconds(v_my_pos.current_zone_id, p_target_zone_id);
  v_arrives := now() + (v_seconds || ' seconds')::interval;

  insert into public.saga_marches (
    bracket_id, crew_id, user_id, origin_zone_id, target_zone_id,
    march_kind, inf, cav, mark, werk, guardian_id, arrives_at
  ) values (
    v_my_pos.bracket_id, v_crew_id, v_user, v_my_pos.current_zone_id, p_target_zone_id,
    'reinforce', p_inf, p_cav, p_mark, p_werk, p_guardian_id, v_arrives
  ) returning id into v_new_id;

  update public.saga_user_state
     set march_slots_used = march_slots_used + 1,
         saga_slot_inf = saga_slot_inf + p_inf,
         saga_slot_cav = saga_slot_cav + p_cav,
         saga_slot_mark = saga_slot_mark + p_mark,
         saga_slot_werk = saga_slot_werk + p_werk,
         updated_at = now()
   where user_id = v_user;

  return query select true, 'reinforcing', v_new_id, v_seconds;
end $$;
grant execute on function public.saga_send_reinforcement(uuid, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_start_rally (Crew-Lead startet 24h-Rally)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_start_rally(
  p_target_zone_id uuid,
  p_joinable_minutes int default 60
) returns table (ok boolean, message text, rally_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid; v_role text;
  v_target public.saga_zones%rowtype;
  v_new_id uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid; return; end if;
  select crew_id, role into v_crew_id, v_role from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid; return; end if;
  if v_role not in ('leader','officer') then return query select false, 'not_leader', null::uuid; return; end if;

  select * into v_target from public.saga_zones where id = p_target_zone_id;
  if v_target.id is null then return query select false, 'zone_not_found', null::uuid; return; end if;

  insert into public.saga_rallies (bracket_id, crew_id, leader_user_id, target_zone_id, joinable_until, marches_at)
  values (v_target.bracket_id, v_crew_id, v_user, p_target_zone_id,
          now() + (p_joinable_minutes || ' minutes')::interval,
          now() + (p_joinable_minutes || ' minutes')::interval)
  returning id into v_new_id;

  return query select true, 'rally_started', v_new_id;
end $$;
grant execute on function public.saga_start_rally(uuid, int) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_join_rally
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_join_rally(
  p_rally_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
) returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_rally public.saga_rallies%rowtype;
  v_my_pos public.saga_user_positions%rowtype;
  v_state public.saga_user_state%rowtype;
  v_total int;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  v_total := coalesce(p_inf,0)+coalesce(p_cav,0)+coalesce(p_mark,0)+coalesce(p_werk,0);
  if v_total <= 0 then return query select false, 'no_troops'; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew'; return; end if;

  select * into v_rally from public.saga_rallies where id = p_rally_id;
  if v_rally.id is null then return query select false, 'rally_not_found'; return; end if;
  if v_rally.crew_id != v_crew_id then return query select false, 'wrong_crew'; return; end if;
  if v_rally.status != 'gathering' then return query select false, 'rally_closed'; return; end if;
  if v_rally.joinable_until <= now() then return query select false, 'rally_expired'; return; end if;
  if v_rally.participant_count >= 10 then return query select false, 'rally_full'; return; end if;

  select * into v_my_pos from public.saga_user_positions where user_id = v_user;
  if v_my_pos.user_id is null then return query select false, 'no_position'; return; end if;

  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.march_slots_used >= v_state.march_slots_total then
    return query select false, 'no_march_slots'; return;
  end if;

  insert into public.saga_marches (
    bracket_id, crew_id, user_id, origin_zone_id, target_zone_id,
    march_kind, inf, cav, mark, werk, guardian_id, arrives_at,
    rally_parent_id
  ) values (
    v_rally.bracket_id, v_crew_id, v_user, v_my_pos.current_zone_id, v_rally.target_zone_id,
    'rally_join', p_inf, p_cav, p_mark, p_werk, p_guardian_id, v_rally.marches_at,
    null
  );

  update public.saga_rallies set participant_count = participant_count + 1 where id = p_rally_id;
  update public.saga_user_state
     set march_slots_used = march_slots_used + 1,
         saga_slot_inf = saga_slot_inf + p_inf,
         saga_slot_cav = saga_slot_cav + p_cav,
         saga_slot_mark = saga_slot_mark + p_mark,
         saga_slot_werk = saga_slot_werk + p_werk,
         updated_at = now()
   where user_id = v_user;

  return query select true, 'joined';
end $$;
grant execute on function public.saga_join_rally(uuid, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_cancel_rally (Lead bricht Rally ab)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_cancel_rally(p_rally_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_rally public.saga_rallies%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select * into v_rally from public.saga_rallies where id = p_rally_id;
  if v_rally.id is null or v_rally.leader_user_id != v_user then
    return query select false, 'not_leader'; return;
  end if;
  if v_rally.status != 'gathering' then return query select false, 'cannot_cancel'; return; end if;

  update public.saga_rallies set status = 'cancelled' where id = p_rally_id;
  -- Alle joins recallen
  update public.saga_marches set status = 'recalled', resolved_at = now()
   where rally_parent_id = p_rally_id and status = 'marching';

  return query select true, 'cancelled';
end $$;
grant execute on function public.saga_cancel_rally(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_start_gather (Tile-RSS sammeln)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_start_gather(
  p_zone_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
) returns table (ok boolean, message text, march_id uuid, arrives_in_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_zone public.saga_zones%rowtype;
  v_my_pos public.saga_user_positions%rowtype;
  v_state public.saga_user_state%rowtype;
  v_seconds int;
  v_arrives timestamptz;
  v_new_id uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid, 0; return; end if;
  select * into v_zone from public.saga_zones where id = p_zone_id;
  if v_zone.id is null then return query select false, 'zone_not_found', null::uuid, 0; return; end if;
  if not v_zone.is_gather_tile then return query select false, 'not_gather_tile', null::uuid, 0; return; end if;
  if v_zone.gather_remaining <= 0 then return query select false, 'tile_depleted', null::uuid, 0; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid, 0; return; end if;

  select * into v_my_pos from public.saga_user_positions where user_id = v_user;
  if v_my_pos.user_id is null then return query select false, 'no_position', null::uuid, 0; return; end if;

  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.march_slots_used >= v_state.march_slots_total then
    return query select false, 'no_march_slots', null::uuid, 0; return;
  end if;

  v_seconds := public._saga_calc_march_seconds(v_my_pos.current_zone_id, p_zone_id);
  v_arrives := now() + (v_seconds || ' seconds')::interval;

  insert into public.saga_marches (
    bracket_id, crew_id, user_id, origin_zone_id, target_zone_id,
    march_kind, inf, cav, mark, werk, guardian_id, arrives_at
  ) values (
    v_zone.bracket_id, v_crew_id, v_user, v_my_pos.current_zone_id, p_zone_id,
    'gather', p_inf, p_cav, p_mark, p_werk, p_guardian_id, v_arrives
  ) returning id into v_new_id;

  update public.saga_user_state
     set march_slots_used = march_slots_used + 1,
         saga_slot_inf = saga_slot_inf + p_inf,
         saga_slot_cav = saga_slot_cav + p_cav,
         saga_slot_mark = saga_slot_mark + p_mark,
         saga_slot_werk = saga_slot_werk + p_werk
   where user_id = v_user;

  return query select true, 'gathering', v_new_id, v_seconds;
end $$;
grant execute on function public.saga_start_gather(uuid, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_use_buff_item
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_use_buff_item(p_item_kind text)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_state public.saga_user_state%rowtype;
  v_qty int;
  v_buff_kind text;
  v_mult numeric;
  v_dur int;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.bracket_id is null then return query select false, 'no_bracket'; return; end if;

  select qty into v_qty from public.saga_user_inventory
   where user_id = v_user and bracket_id = v_state.bracket_id and item_kind = p_item_kind;
  if v_qty is null or v_qty <= 0 then return query select false, 'no_item'; return; end if;

  case p_item_kind
    when 'buff_atk_30min'        then v_buff_kind := 'atk';        v_mult := 1.5; v_dur := 30;
    when 'buff_def_30min'        then v_buff_kind := 'def';        v_mult := 1.5; v_dur := 30;
    when 'buff_marchspeed_30min' then v_buff_kind := 'marchspeed'; v_mult := 1.5; v_dur := 30;
    when 'buff_gather_30min'     then v_buff_kind := 'gather';     v_mult := 1.3; v_dur := 30;
    when 'shield_8h'             then v_buff_kind := 'shield';     v_mult := 1.0; v_dur := 480;
    when 'shield_24h'            then v_buff_kind := 'shield';     v_mult := 1.0; v_dur := 1440;
    else
      return query select false, 'invalid_item'; return;
  end case;

  if v_buff_kind = 'shield' then
    insert into public.saga_user_shields (user_id, bracket_id, expires_at)
    values (v_user, v_state.bracket_id, now() + (v_dur || ' minutes')::interval)
    on conflict (user_id, bracket_id) do update set expires_at = greatest(saga_user_shields.expires_at, excluded.expires_at);
  else
    insert into public.saga_active_buffs (user_id, bracket_id, buff_kind, multiplier, expires_at)
    values (v_user, v_state.bracket_id, v_buff_kind, v_mult, now() + (v_dur || ' minutes')::interval);
  end if;

  update public.saga_user_inventory set qty = qty - 1
   where user_id = v_user and bracket_id = v_state.bracket_id and item_kind = p_item_kind;

  return query select true, 'used';
end $$;
grant execute on function public.saga_use_buff_item(text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_use_migration_item (Teleport)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_use_migration_item(
  p_item_kind text,
  p_target_zone_id uuid default null  -- bei targeted/advanced
) returns table (ok boolean, message text, new_zone_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_state public.saga_user_state%rowtype;
  v_qty int;
  v_target_zone uuid;
  v_random_zone uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid; return; end if;
  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.bracket_id is null then return query select false, 'no_bracket', null::uuid; return; end if;

  select qty into v_qty from public.saga_user_inventory
   where user_id = v_user and bracket_id = v_state.bracket_id and item_kind = p_item_kind;
  if v_qty is null or v_qty <= 0 then return query select false, 'no_item', null::uuid; return; end if;

  if p_item_kind = 'tele_random' then
    -- Random unter eigene oder neutrale district-Zonen im Außenring
    select id into v_random_zone from public.saga_zones
     where bracket_id = v_state.bracket_id and zone_kind = 'district'
       and (owner_crew_id is null
            or owner_crew_id = (select crew_id from public.crew_members where user_id = v_user limit 1))
     order by random() limit 1;
    v_target_zone := v_random_zone;
  elsif p_item_kind in ('tele_targeted','tele_advanced') then
    if p_target_zone_id is null then return query select false, 'target_required', null::uuid; return; end if;
    -- Targeted nur in eigene Zonen, Advanced auch in neutrale + Spawn
    if p_item_kind = 'tele_targeted' then
      if not exists(select 1 from public.saga_zones where id = p_target_zone_id
                    and owner_crew_id = (select crew_id from public.crew_members where user_id = v_user limit 1)) then
        return query select false, 'target_not_owned', null::uuid; return;
      end if;
    end if;
    v_target_zone := p_target_zone_id;
  else
    return query select false, 'invalid_item', null::uuid; return;
  end if;

  insert into public.saga_user_positions (user_id, bracket_id, current_zone_id)
  values (v_user, v_state.bracket_id, v_target_zone)
  on conflict (user_id, bracket_id) do update set current_zone_id = excluded.current_zone_id;

  update public.saga_user_inventory set qty = qty - 1
   where user_id = v_user and bracket_id = v_state.bracket_id and item_kind = p_item_kind;

  return query select true, 'teleported', v_target_zone;
end $$;
grant execute on function public.saga_use_migration_item(text, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_propose_nap, saga_accept_nap, saga_break_nap
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_propose_nap(p_other_crew_id uuid, p_hours int default 24)
returns table (ok boolean, message text, dip_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid; v_role text;
  v_my_bracket uuid;
  v_new_id uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid; return; end if;
  select crew_id, role into v_my_crew, v_role from public.crew_members where user_id = v_user limit 1;
  if v_my_crew is null then return query select false, 'no_crew', null::uuid; return; end if;
  if v_role not in ('leader','officer') then return query select false, 'not_leader', null::uuid; return; end if;

  -- Beide Crews müssen im selben Bracket sein
  select bracket_id into v_my_bracket from public.saga_bracket_crews
   where crew_id = v_my_crew
     and exists(select 1 from public.saga_brackets b where b.id = bracket_id and b.status in ('auftakt','main','apex_hold'));
  if v_my_bracket is null then return query select false, 'not_in_active_bracket', null::uuid; return; end if;

  if not exists(select 1 from public.saga_bracket_crews where bracket_id = v_my_bracket and crew_id = p_other_crew_id) then
    return query select false, 'other_not_in_bracket', null::uuid; return;
  end if;

  insert into public.saga_diplomacy (bracket_id, crew_a, crew_b, pact_kind, status, expires_at, proposed_by)
  values (v_my_bracket, v_my_crew, p_other_crew_id, 'nap', 'proposed',
          now() + (p_hours || ' hours')::interval, v_user)
  on conflict (bracket_id, crew_a, crew_b) do update
    set pact_kind = 'nap', status = 'proposed', expires_at = excluded.expires_at, proposed_by = v_user
  returning id into v_new_id;

  return query select true, 'proposed', v_new_id;
end $$;
grant execute on function public.saga_propose_nap(uuid, int) to authenticated;

create or replace function public.saga_accept_nap(p_dip_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid; v_role text;
  v_dip public.saga_diplomacy%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select crew_id, role into v_my_crew, v_role from public.crew_members where user_id = v_user limit 1;
  if v_role not in ('leader','officer') then return query select false, 'not_leader'; return; end if;

  select * into v_dip from public.saga_diplomacy where id = p_dip_id;
  if v_dip.id is null or v_dip.status != 'proposed' then return query select false, 'invalid_dip'; return; end if;
  if v_dip.crew_b != v_my_crew and v_dip.crew_a != v_my_crew then return query select false, 'not_party'; return; end if;
  if v_dip.proposed_by = v_user then return query select false, 'cannot_self_accept'; return; end if;

  update public.saga_diplomacy
     set status = 'active', accepted_at = now(), accepted_by = v_user
   where id = p_dip_id;

  return query select true, 'accepted';
end $$;
grant execute on function public.saga_accept_nap(uuid) to authenticated;

create or replace function public.saga_break_nap(p_dip_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid; v_role text;
  v_dip public.saga_diplomacy%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select crew_id, role into v_my_crew, v_role from public.crew_members where user_id = v_user limit 1;
  if v_role not in ('leader','officer') then return query select false, 'not_leader'; return; end if;

  select * into v_dip from public.saga_diplomacy where id = p_dip_id;
  if v_dip.crew_a != v_my_crew and v_dip.crew_b != v_my_crew then return query select false, 'not_party'; return; end if;

  update public.saga_diplomacy set status = 'broken' where id = p_dip_id;
  return query select true, 'broken';
end $$;
grant execute on function public.saga_break_nap(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- RPC: saga_attack_behemoth
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_attack_behemoth(
  p_mega_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
) returns table (ok boolean, message text, damage bigint, mega_killed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_mega public.saga_mega_camps%rowtype;
  v_my_pos public.saga_user_positions%rowtype;
  v_dmg bigint;
  v_atk_strength numeric;
  v_killed boolean := false;
begin
  if v_user is null then return query select false, 'not_authenticated', 0::bigint, false; return; end if;
  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', 0::bigint, false; return; end if;

  select * into v_mega from public.saga_mega_camps where id = p_mega_id;
  if v_mega.id is null then return query select false, 'mega_not_found', 0::bigint, false; return; end if;
  if v_mega.status != 'active' then return query select false, 'mega_inactive', 0::bigint, false; return; end if;
  if v_mega.expires_at <= now() then return query select false, 'mega_expired', 0::bigint, false; return; end if;

  select * into v_my_pos from public.saga_user_positions where user_id = v_user;
  if v_my_pos.user_id is null then return query select false, 'no_position', 0::bigint, false; return; end if;
  if v_my_pos.bracket_id != v_mega.bracket_id then return query select false, 'wrong_bracket', 0::bigint, false; return; end if;

  v_atk_strength := (p_inf * 1.0 + p_cav * 1.5 + p_mark * 1.3 + p_werk * 1.2)
                  * public._saga_guardian_battle_mult(p_guardian_id);
  v_dmg := round(v_atk_strength * 10)::bigint;

  if v_dmg >= v_mega.hp_remaining then
    v_dmg := v_mega.hp_remaining;
    v_killed := true;
  end if;

  update public.saga_mega_camps
     set hp_remaining = hp_remaining - v_dmg,
         status = case when v_killed then 'killed' else status end,
         killed_at = case when v_killed then now() else killed_at end,
         first_kill_crew_id = case when v_killed and first_kill_crew_id is null then v_crew_id else first_kill_crew_id end
   where id = p_mega_id;

  insert into public.saga_mega_damage (mega_camp_id, user_id, crew_id, damage)
  values (p_mega_id, v_user, v_crew_id, v_dmg)
  on conflict (mega_camp_id, user_id) do update set damage = saga_mega_damage.damage + v_dmg;

  if v_killed then
    perform public._saga_check_augur_milestone(v_mega.bracket_id, 'first_behemoth_kill', v_crew_id);
    -- Reward an Crew: 100 Saga-Token-Äquivalent (vereinfacht: Verdienste)
    update public.saga_bracket_crews set merits = merits + 1000
     where bracket_id = v_mega.bracket_id and crew_id = v_crew_id;
  end if;

  -- Verdienste an User pro 1000 dmg
  insert into public.saga_user_merits (user_id, bracket_id, merits)
  values (v_user, v_mega.bracket_id, (v_dmg / 1000)::bigint)
  on conflict (user_id, bracket_id) do update set merits = saga_user_merits.merits + (v_dmg / 1000)::bigint;

  return query select true, 'attacked', v_dmg, v_killed;
end $$;
grant execute on function public.saga_attack_behemoth(uuid, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- ÜBERARBEITETES saga_resolve_arrived_marches mit ALLEN Mechaniken
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_resolve_arrived_marches()
returns table (resolved int, battles int)
language plpgsql security definer set search_path = public as $$
declare
  v_march public.saga_marches%rowtype;
  v_target public.saga_zones%rowtype;
  v_def_garrison record;
  v_target_pos public.saga_user_positions%rowtype;
  v_atk_str numeric; v_def_str numeric;
  v_atk_wins boolean;
  v_atk_loss numeric; v_def_loss numeric;
  v_resolved int := 0; v_battles_count int := 0;
  v_atk_wachter_mult numeric; v_def_wachter_mult numeric;
  v_atk_buff_mult numeric; v_atk_holy_mult numeric;
  v_battle_id uuid;
  v_dead int;
begin
  for v_march in
    select * from public.saga_marches where status = 'marching' and arrives_at <= now()
    order by arrives_at asc limit 500
  loop
    update public.saga_marches set status = 'arrived' where id = v_march.id;
    select * into v_target from public.saga_zones where id = v_march.target_zone_id;

    -- ─── REINFORCE ───────────────────────────────────────────
    if v_march.march_kind = 'reinforce' and v_target.owner_crew_id = v_march.crew_id then
      -- Truppen verschmelzen mit erstem eigenem Hauptgebäude in der Zone
      update public.saga_garrisons g
         set inf  = g.inf  + v_march.inf,
             cav  = g.cav  + v_march.cav,
             mark = g.mark + v_march.mark,
             werk = g.werk + v_march.werk,
             updated_at = now()
        from public.saga_buildings b
       where b.id = g.building_id and b.zone_id = v_march.target_zone_id
         and b.crew_id = v_march.crew_id and b.building_kind = 'hauptgebaeude'
         and b.destroyed_at is null;
      update public.saga_user_state set march_slots_used = greatest(0, march_slots_used - 1) where user_id = v_march.user_id;
      update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
      v_resolved := v_resolved + 1; continue;
    end if;

    -- ─── GATHER ───────────────────────────────────────────────
    if v_march.march_kind = 'gather' and v_target.is_gather_tile then
      declare v_yield bigint;
      begin
        v_yield := least(v_target.gather_yield_per_hour, v_target.gather_remaining);
        update public.saga_zones set gather_remaining = greatest(0, gather_remaining - v_yield) where id = v_target.id;
        if v_target.gather_kind = 'tech_schrott' then
          insert into public.saga_user_resources (user_id, bracket_id, tech_schrott)
          values (v_march.user_id, v_march.bracket_id, v_yield)
          on conflict (user_id, bracket_id) do update set tech_schrott = saga_user_resources.tech_schrott + v_yield;
        elsif v_target.gather_kind = 'komponenten' then
          insert into public.saga_user_resources (user_id, bracket_id, komponenten)
          values (v_march.user_id, v_march.bracket_id, v_yield)
          on conflict (user_id, bracket_id) do update set komponenten = saga_user_resources.komponenten + v_yield;
        elsif v_target.gather_kind = 'krypto' then
          insert into public.saga_user_resources (user_id, bracket_id, krypto)
          values (v_march.user_id, v_march.bracket_id, v_yield)
          on conflict (user_id, bracket_id) do update set krypto = saga_user_resources.krypto + v_yield;
        else
          insert into public.saga_user_resources (user_id, bracket_id, bandbreite)
          values (v_march.user_id, v_march.bracket_id, v_yield)
          on conflict (user_id, bracket_id) do update set bandbreite = saga_user_resources.bandbreite + v_yield;
        end if;
        update public.saga_marches set status = 'resolved', resolved_at = now(), gather_collected = v_yield where id = v_march.id;
      end;
      update public.saga_user_state set march_slots_used = greatest(0, march_slots_used - 1) where user_id = v_march.user_id;
      v_resolved := v_resolved + 1; continue;
    end if;

    -- ─── ATTACK_USER (Solo-PvP) ──────────────────────────────
    if v_march.march_kind = 'attack_user' and v_march.target_user_id is not null then
      select * into v_target_pos from public.saga_user_positions where user_id = v_march.target_user_id;

      v_atk_wachter_mult := public._saga_guardian_battle_mult(v_march.guardian_id);
      v_atk_buff_mult := public._saga_user_buff_mult(v_march.user_id, v_march.bracket_id, 'atk');
      v_atk_holy_mult := public._saga_holy_buff_mult(v_march.bracket_id, v_march.crew_id, 'troop_atk');

      v_atk_str := (v_march.inf * 1.0 + v_march.cav * 1.5 + v_march.mark * 1.3 + v_march.werk * 1.2)
                 * v_atk_wachter_mult * v_atk_buff_mult * v_atk_holy_mult;

      if v_target_pos.user_id is not null then
        v_def_wachter_mult := public._saga_guardian_battle_mult(v_target_pos.field_guardian_id);
        v_def_str := (v_target_pos.field_inf * 1.1 + v_target_pos.field_cav * 1.5
                    + v_target_pos.field_mark * 1.4 + v_target_pos.field_werk * 1.3)
                   * v_def_wachter_mult;
      else
        v_def_str := 0;
      end if;

      v_atk_wins := v_atk_str > v_def_str * 0.9;
      if v_atk_wins then
        v_atk_loss := least(0.3, coalesce(v_def_str, 0) / nullif(v_atk_str, 0));
        v_def_loss := 0.85;
      else
        v_atk_loss := 0.85; v_def_loss := least(0.3, v_atk_str / nullif(v_def_str, 0));
      end if;

      insert into public.saga_battles (
        bracket_id, zone_id, attacker_crew_id, attacker_user_id, defender_user_id,
        attacker_inf, attacker_cav, attacker_mark, attacker_werk,
        defender_inf, defender_cav, defender_mark, defender_werk,
        attacker_losses_dead, attacker_losses_wounded,
        defender_losses_dead, defender_losses_wounded,
        outcome, battle_kind
      ) values (
        v_march.bracket_id, v_march.target_zone_id, v_march.crew_id, v_march.user_id, v_march.target_user_id,
        v_march.inf, v_march.cav, v_march.mark, v_march.werk,
        coalesce(v_target_pos.field_inf,0), coalesce(v_target_pos.field_cav,0),
        coalesce(v_target_pos.field_mark,0), coalesce(v_target_pos.field_werk,0),
        round((v_march.inf+v_march.cav+v_march.mark+v_march.werk) * v_atk_loss * 0.5)::int,
        round((v_march.inf+v_march.cav+v_march.mark+v_march.werk) * v_atk_loss * 0.5)::int,
        round((coalesce(v_target_pos.field_inf,0)+coalesce(v_target_pos.field_cav,0)
              +coalesce(v_target_pos.field_mark,0)+coalesce(v_target_pos.field_werk,0)) * v_def_loss * 0.5)::int,
        round((coalesce(v_target_pos.field_inf,0)+coalesce(v_target_pos.field_cav,0)
              +coalesce(v_target_pos.field_mark,0)+coalesce(v_target_pos.field_werk,0)) * v_def_loss * 0.5)::int,
        case when v_atk_wins then 'attacker_won' else 'defender_won' end,
        'user'
      ) returning id into v_battle_id;
      v_battles_count := v_battles_count + 1;

      if v_atk_wins and v_target_pos.user_id is not null then
        update public.saga_user_positions
           set field_inf = round(field_inf * (1 - v_def_loss))::int,
               field_cav = round(field_cav * (1 - v_def_loss))::int,
               field_mark = round(field_mark * (1 - v_def_loss))::int,
               field_werk = round(field_werk * (1 - v_def_loss))::int
         where user_id = v_march.target_user_id;
      end if;

      update public.saga_user_state set march_slots_used = greatest(0, march_slots_used - 1) where user_id = v_march.user_id;
      update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
      v_resolved := v_resolved + 1; continue;
    end if;

    -- ─── ATTACK auf Zone (Buildings + Garrison) ──────────────
    if v_march.march_kind in ('attack','rally_join') then
      -- Wenn rally_join: warten bis alle joins angekommen sind (rally_main wird separat gestartet)
      if v_march.march_kind = 'rally_join' then
        update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
        v_resolved := v_resolved + 1; continue;
      end if;

      v_atk_wachter_mult := public._saga_guardian_battle_mult(v_march.guardian_id);
      v_atk_buff_mult := public._saga_user_buff_mult(v_march.user_id, v_march.bracket_id, 'atk');
      v_atk_holy_mult := public._saga_holy_buff_mult(v_march.bracket_id, v_march.crew_id, 'troop_atk');

      v_atk_str := (v_march.inf * 1.0 + v_march.cav * 1.5 + v_march.mark * 1.3 + v_march.werk * 1.2)
                 * v_atk_wachter_mult * v_atk_buff_mult * v_atk_holy_mult;

      select coalesce(sum(g.inf), 0) as inf, coalesce(sum(g.cav), 0) as cav,
             coalesce(sum(g.mark), 0) as mark, coalesce(sum(g.werk), 0) as werk
        into v_def_garrison
        from public.saga_buildings b join public.saga_garrisons g on g.building_id = b.id
       where b.zone_id = v_march.target_zone_id and b.destroyed_at is null;

      v_def_str := coalesce(v_def_garrison.inf,0) * 1.1 + coalesce(v_def_garrison.cav,0) * 1.5
                 + coalesce(v_def_garrison.mark,0) * 1.4 + coalesce(v_def_garrison.werk,0) * 1.3;

      if v_target.owner_crew_id is not null then
        v_def_str := v_def_str * public._saga_holy_buff_mult(v_march.bracket_id, v_target.owner_crew_id, 'troop_def');
      end if;

      v_atk_wins := v_atk_str > v_def_str * 0.9;
      if v_atk_wins then
        v_atk_loss := least(0.3, v_def_str / nullif(v_atk_str, 0));
        v_def_loss := 0.85;
      else
        v_atk_loss := 0.85;
        v_def_loss := least(0.3, v_atk_str / nullif(v_def_str, 0));
      end if;

      insert into public.saga_battles (
        bracket_id, zone_id, attacker_crew_id, defender_crew_id, attacker_user_id,
        attacker_inf, attacker_cav, attacker_mark, attacker_werk,
        defender_inf, defender_cav, defender_mark, defender_werk,
        attacker_losses_dead, attacker_losses_wounded,
        defender_losses_dead, defender_losses_wounded,
        outcome, battle_kind
      ) values (
        v_march.bracket_id, v_march.target_zone_id, v_march.crew_id, v_target.owner_crew_id, v_march.user_id,
        v_march.inf, v_march.cav, v_march.mark, v_march.werk,
        coalesce(v_def_garrison.inf,0), coalesce(v_def_garrison.cav,0),
        coalesce(v_def_garrison.mark,0), coalesce(v_def_garrison.werk,0),
        round((v_march.inf+v_march.cav+v_march.mark+v_march.werk) * v_atk_loss * 0.5)::int,
        round((v_march.inf+v_march.cav+v_march.mark+v_march.werk) * v_atk_loss * 0.5)::int,
        round((coalesce(v_def_garrison.inf,0)+coalesce(v_def_garrison.cav,0)
             +coalesce(v_def_garrison.mark,0)+coalesce(v_def_garrison.werk,0)) * v_def_loss * 0.3)::int,
        round((coalesce(v_def_garrison.inf,0)+coalesce(v_def_garrison.cav,0)
             +coalesce(v_def_garrison.mark,0)+coalesce(v_def_garrison.werk,0)) * v_def_loss * 0.7)::int,
        case when v_atk_wins then 'attacker_won' else 'defender_won' end,
        case when v_target.is_holy_site then 'holy_capture' else 'zone' end
      ) returning id into v_battle_id;
      v_battles_count := v_battles_count + 1;

      if v_atk_wins then
        update public.saga_buildings set hp = 0, destroyed_at = now()
         where zone_id = v_march.target_zone_id and crew_id = v_target.owner_crew_id and destroyed_at is null;
        update public.saga_zones set owner_crew_id = v_march.crew_id where id = v_march.target_zone_id;
        update public.saga_bracket_crews set zones_held = zones_held + 1, merits = merits + 200
         where bracket_id = v_march.bracket_id and crew_id = v_march.crew_id;
        if v_target.owner_crew_id is not null then
          update public.saga_bracket_crews set zones_held = greatest(0, zones_held - 1)
           where bracket_id = v_march.bracket_id and crew_id = v_target.owner_crew_id;
        end if;

        -- Holy-Site capture
        if v_target.is_holy_site then
          insert into public.saga_holy_holders (zone_id, bracket_id, crew_id, held_since)
          values (v_target.id, v_march.bracket_id, v_march.crew_id, now())
          on conflict (zone_id) do update set crew_id = excluded.crew_id, held_since = now();
          perform public._saga_check_augur_milestone(v_march.bracket_id, 'first_holy_capture', v_march.crew_id);
        end if;

        if v_target.zone_kind = 'apex' then
          update public.saga_brackets set apex_holder_crew_id = v_march.crew_id, apex_hold_started_at = now() where id = v_march.bracket_id;
          perform public._saga_check_augur_milestone(v_march.bracket_id, 'first_apex_touch', v_march.crew_id);
        end if;

        insert into public.saga_progress_log (bracket_id, crew_id, event_kind, payload)
        values (v_march.bracket_id, v_march.crew_id, 'zone_captured',
                jsonb_build_object('zone', v_march.target_zone_id, 'name', v_target.name));
      end if;

      v_dead := round((v_march.inf+v_march.cav+v_march.mark+v_march.werk) * v_atk_loss * 0.5)::int;
      insert into public.saga_lazarett (user_id, bracket_id, inf, cav, mark, werk)
      values (v_march.user_id, v_march.bracket_id,
              round(v_march.inf  * v_atk_loss * 0.5)::int,
              round(v_march.cav  * v_atk_loss * 0.5)::int,
              round(v_march.mark * v_atk_loss * 0.5)::int,
              round(v_march.werk * v_atk_loss * 0.5)::int)
      on conflict (user_id, bracket_id) do update set
        inf = saga_lazarett.inf + excluded.inf, cav = saga_lazarett.cav + excluded.cav,
        mark = saga_lazarett.mark + excluded.mark, werk = saga_lazarett.werk + excluded.werk;
      update public.saga_bracket_crews set troops_lost = troops_lost + v_dead
       where bracket_id = v_march.bracket_id and crew_id = v_march.crew_id;
    end if;

    update public.saga_user_state set march_slots_used = greatest(0, march_slots_used - 1) where user_id = v_march.user_id;
    update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
    v_resolved := v_resolved + 1;
  end loop;

  return query select v_resolved, v_battles_count;
end $$;
grant execute on function public.saga_resolve_arrived_marches() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: saga_holy_tick — total_hold_seconds aktualisieren
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_holy_tick()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
begin
  update public.saga_holy_holders
     set total_hold_seconds = total_hold_seconds + extract(epoch from (now() - updated_at))::bigint,
         updated_at = now()
   where crew_id is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.saga_holy_tick() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: saga_buff_tick — abgelaufene Buffs/Shields löschen
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_buff_tick()
returns table (buffs_expired int, shields_expired int)
language plpgsql security definer set search_path = public as $$
declare
  v_buffs int; v_shields int;
begin
  delete from public.saga_active_buffs where expires_at <= now();
  get diagnostics v_buffs = row_count;
  delete from public.saga_user_shields where expires_at <= now();
  get diagnostics v_shields = row_count;
  return query select v_buffs, v_shields;
end $$;
grant execute on function public.saga_buff_tick() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: saga_ap_reset — täglich Action-Points zurücksetzen
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_ap_reset()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  update public.saga_user_state
     set action_points = action_points_max,
         pvp_attacks_today = 0,
         ap_last_reset_at = now()
   where ap_last_reset_at < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.saga_ap_reset() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: saga_distribute_augur_rewards — verteilt augur-Rewards an Crews
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_distribute_augur_rewards()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_milestone public.saga_augur_milestones%rowtype;
  v_member record;
  v_distributed int := 0;
begin
  for v_milestone in
    select * from public.saga_augur_milestones where rewards_distributed = false
  loop
    if v_milestone.crew_id is not null and v_milestone.reward_gems > 0 then
      for v_member in select user_id from public.crew_members where crew_id = v_milestone.crew_id loop
        update public.users set gems = coalesce(gems, 0) + v_milestone.reward_gems
         where id = v_member.user_id;
        v_distributed := v_distributed + 1;
      end loop;
    end if;
    update public.saga_augur_milestones set rewards_distributed = true where id = v_milestone.id;
  end loop;
  return v_distributed;
end $$;
grant execute on function public.saga_distribute_augur_rewards() to service_role;
