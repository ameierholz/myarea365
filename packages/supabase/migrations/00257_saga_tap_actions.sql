-- 00257: Saga Tap-Aktionen
--
-- saga_relocate_base   — User verschiebt eigene Position auf der Map (Verlegen)
-- saga_redirect_march  — User leitet bestehenden Marsch auf neues Ziel um (Drag-to-Move)
-- saga_hide_in_building — User parkt Field-Truppen in eigenem Building (Wegelager/MegaRepeater/HQ)
-- saga_unhide_from_building — Field-Truppen wieder rausholen
-- saga_deploy_multi    — Mehrere Aufgebote parallel losschicken

-- ════════════════════════════════════════════════════════════════
-- saga_relocate_base — User-Position auf Map verschieben
-- (NUR auf eigene district-Zonen oder eigene Spawn-Zone, keine teleport-items nötig
--  innerhalb des eigenen Crew-Reviers; Migration-Items sind für distant-targets)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_relocate_base(p_target_zone_id uuid)
returns table (ok boolean, message text, new_zone_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_state public.saga_user_state%rowtype;
  v_zone public.saga_zones%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid; return; end if;
  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid; return; end if;
  select * into v_zone from public.saga_zones where id = p_target_zone_id;
  if v_zone.id is null then return query select false, 'zone_not_found', null::uuid; return; end if;
  -- Nur auf eigene Zonen oder eigene Spawn
  if v_zone.owner_crew_id != v_crew_id and v_zone.zone_kind != 'spawn' then
    return query select false, 'zone_not_owned', null::uuid; return;
  end if;
  if v_zone.zone_kind = 'spawn' and not exists(
    select 1 from public.saga_bracket_crews where bracket_id = v_zone.bracket_id and crew_id = v_crew_id and spawn_zone_id = v_zone.id
  ) then return query select false, 'not_own_spawn', null::uuid; return; end if;

  insert into public.saga_user_positions (user_id, bracket_id, current_zone_id)
  values (v_user, v_zone.bracket_id, v_zone.id)
  on conflict (user_id, bracket_id) do update set current_zone_id = excluded.current_zone_id;

  return query select true, 'relocated', v_zone.id;
end $$;
grant execute on function public.saga_relocate_base(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- saga_redirect_march — Drag-to-Move: bestehenden Marsch umleiten
-- (Keine Recall+New, sondern direkt neues Ziel; Marsch-Zeit wird neu berechnet
--  von aktueller "geschätzter" Position. Vereinfacht: vom Ursprung neu.)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_redirect_march(p_march_id uuid, p_new_target_zone_id uuid)
returns table (ok boolean, message text, new_arrives_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_march public.saga_marches%rowtype;
  v_seconds int;
  v_new_arrives timestamptz;
begin
  if v_user is null then return query select false, 'not_authenticated', null::timestamptz; return; end if;
  select * into v_march from public.saga_marches where id = p_march_id;
  if v_march.id is null or v_march.user_id != v_user then return query select false, 'not_yours', null::timestamptz; return; end if;
  if v_march.status != 'marching' then return query select false, 'cannot_redirect', null::timestamptz; return; end if;

  -- Validierung: Ziel muss im selben Bracket sein
  if not exists(select 1 from public.saga_zones where id = p_new_target_zone_id and bracket_id = v_march.bracket_id) then
    return query select false, 'cross_bracket', null::timestamptz; return;
  end if;

  v_seconds := public._saga_calc_march_seconds(v_march.origin_zone_id, p_new_target_zone_id);
  v_new_arrives := now() + (v_seconds || ' seconds')::interval;

  update public.saga_marches
     set target_zone_id = p_new_target_zone_id,
         arrives_at = v_new_arrives
   where id = p_march_id;

  return query select true, 'redirected', v_new_arrives;
end $$;
grant execute on function public.saga_redirect_march(uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- saga_hide_in_building — Field-Truppen in Building verstecken
-- (Building muss eigene Crew gehören. Zugleich zone in saga_user_positions setzen.)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_hide_in_building(p_building_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_pos public.saga_user_positions%rowtype;
  v_building public.saga_buildings%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew'; return; end if;

  select * into v_building from public.saga_buildings where id = p_building_id;
  if v_building.id is null or v_building.destroyed_at is not null then return query select false, 'building_invalid'; return; end if;
  if v_building.crew_id != v_crew_id then return query select false, 'not_own_building'; return; end if;

  select * into v_pos from public.saga_user_positions where user_id = v_user and bracket_id = v_building.bracket_id;
  if v_pos.user_id is null then return query select false, 'no_position'; return; end if;

  -- Field-Truppen in Garrison verschieben
  insert into public.saga_garrisons (building_id, inf, cav, mark, werk)
  values (p_building_id, v_pos.field_inf, v_pos.field_cav, v_pos.field_mark, v_pos.field_werk)
  on conflict (building_id) do update set
    inf  = saga_garrisons.inf  + excluded.inf,
    cav  = saga_garrisons.cav  + excluded.cav,
    mark = saga_garrisons.mark + excluded.mark,
    werk = saga_garrisons.werk + excluded.werk,
    updated_at = now();

  -- Field-Truppen leeren + Position auf Building-Zone
  update public.saga_user_positions
     set current_zone_id = v_building.zone_id,
         field_inf = 0, field_cav = 0, field_mark = 0, field_werk = 0
   where user_id = v_user and bracket_id = v_building.bracket_id;

  return query select true, 'hidden';
end $$;
grant execute on function public.saga_hide_in_building(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- saga_unhide_from_building — Truppen aus Garrison rausholen
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_unhide_from_building(
  p_building_id uuid,
  p_inf int, p_cav int, p_mark int, p_werk int
) returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_garrison public.saga_garrisons%rowtype;
  v_building public.saga_buildings%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;
  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  select * into v_building from public.saga_buildings where id = p_building_id;
  if v_building.crew_id != v_crew_id then return query select false, 'not_own'; return; end if;
  select * into v_garrison from public.saga_garrisons where building_id = p_building_id;
  if v_garrison.building_id is null then return query select false, 'no_garrison'; return; end if;
  if v_garrison.inf < p_inf or v_garrison.cav < p_cav
     or v_garrison.mark < p_mark or v_garrison.werk < p_werk then
    return query select false, 'insufficient_garrison'; return;
  end if;

  update public.saga_garrisons
     set inf = inf - p_inf, cav = cav - p_cav,
         mark = mark - p_mark, werk = werk - p_werk, updated_at = now()
   where building_id = p_building_id;

  insert into public.saga_user_positions (user_id, bracket_id, current_zone_id, field_inf, field_cav, field_mark, field_werk)
  values (v_user, v_building.bracket_id, v_building.zone_id, p_inf, p_cav, p_mark, p_werk)
  on conflict (user_id, bracket_id) do update set
    current_zone_id = v_building.zone_id,
    field_inf = saga_user_positions.field_inf + excluded.field_inf,
    field_cav = saga_user_positions.field_cav + excluded.field_cav,
    field_mark = saga_user_positions.field_mark + excluded.field_mark,
    field_werk = saga_user_positions.field_werk + excluded.field_werk;

  return query select true, 'unhidden';
end $$;
grant execute on function public.saga_unhide_from_building(uuid, int, int, int, int) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- saga_deploy_multi — bis zu 5 Aufgebote parallel losschicken
-- legions: jsonb [{ kind, target_zone_id, target_user_id?, inf, cav, mark, werk, guardian_id? }, ...]
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_deploy_multi(p_legions jsonb)
returns table (ok boolean, message text, march_ids uuid[])
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_legion jsonb;
  v_march_id uuid;
  v_ids uuid[] := '{}';
  v_kind text;
  v_state public.saga_user_state%rowtype;
  v_count int := 0;
  v_result record;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid[]; return; end if;

  v_count := jsonb_array_length(p_legions);
  if v_count <= 0 then return query select false, 'no_legions', null::uuid[]; return; end if;
  if v_count > 5 then return query select false, 'too_many_legions', null::uuid[]; return; end if;

  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.user_id is null then return query select false, 'no_state', null::uuid[]; return; end if;
  if v_state.march_slots_used + v_count > v_state.march_slots_total then
    return query select false, 'not_enough_slots', null::uuid[]; return;
  end if;

  for v_legion in select * from jsonb_array_elements(p_legions)
  loop
    v_kind := v_legion->>'kind';
    if v_kind = 'attack' or v_kind = 'reinforce' or v_kind = 'gather' then
      select * into v_result from public.saga_start_march(
        coalesce((v_legion->>'origin_zone_id')::uuid, v_state.bracket_id),  -- vereinfacht: muss noch korrekt befüllt werden
        (v_legion->>'target_zone_id')::uuid,
        v_kind,
        coalesce((v_legion->>'inf')::int, 0),
        coalesce((v_legion->>'cav')::int, 0),
        coalesce((v_legion->>'mark')::int, 0),
        coalesce((v_legion->>'werk')::int, 0),
        nullif(v_legion->>'guardian_id', '')::uuid
      );
      if v_result.ok then v_ids := v_ids || v_result.march_id; end if;
    elsif v_kind = 'attack_user' then
      select * into v_result from public.saga_attack_user(
        (v_legion->>'target_user_id')::uuid,
        coalesce((v_legion->>'inf')::int, 0),
        coalesce((v_legion->>'cav')::int, 0),
        coalesce((v_legion->>'mark')::int, 0),
        coalesce((v_legion->>'werk')::int, 0),
        nullif(v_legion->>'guardian_id', '')::uuid
      );
      if v_result.ok then v_ids := v_ids || v_result.march_id; end if;
    end if;
  end loop;

  return query select true, 'deployed', v_ids;
end $$;
grant execute on function public.saga_deploy_multi(jsonb) to authenticated;
