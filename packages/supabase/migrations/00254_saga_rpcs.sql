-- 00254: Saga RPCs — Lifecycle + Aktionen
--
-- Lifecycle:
--   saga_signup_crew(round_id)              — Crew-Lead meldet seine Crew an
--   saga_withdraw_crew(round_id)            — Crew-Lead zieht Anmeldung zurück
--   saga_run_matchmaking(round_id)          — Cron: gruppiert angemeldete Crews in Brackets
--   saga_advance_phases()                   — Cron: öffnet Tore basierend auf bracket-Alter
--   saga_resolve_arrived_marches()          — Cron: löst angekommene Märsche auf
--   saga_check_apex_holds()                 — Cron: prüft 48h-Apex-Hold
--   saga_finalize_brackets()                — Cron: schließt fertige Brackets ab
--
-- Aktionen:
--   saga_build_repeater(zone_id)
--   saga_build_hauptgebaeude(zone_id)
--   saga_start_march(target_zone_id, kind, inf, cav, mark, werk, guardian_id)
--   saga_recall_march(march_id)
--   saga_start_rally(target_zone_id, joinable_minutes)
--   saga_join_rally(rally_id, inf, cav, mark, werk, guardian_id)
--   saga_attack_mega(mega_id, inf, cav, mark, werk, guardian_id)
--   saga_spend_merits(item_kind, qty)

-- ════════════════════════════════════════════════════════════════
-- HELPERS
-- ════════════════════════════════════════════════════════════════

-- Berechnet Marsch-Zeit zwischen zwei Zonen (in Sekunden).
-- Formel: Distanz in km × 60s/km (= 60km/h Marsch-Geschwindigkeit Basis)
-- Mindestens 60s, maximal 4h.
create or replace function public._saga_calc_march_seconds(p_origin uuid, p_target uuid)
returns int language plpgsql stable as $$
declare
  v_o_lat numeric; v_o_lng numeric;
  v_t_lat numeric; v_t_lng numeric;
  v_dist_km numeric;
  v_seconds int;
begin
  select centroid_lat, centroid_lng into v_o_lat, v_o_lng from public.saga_zones where id = p_origin;
  select centroid_lat, centroid_lng into v_t_lat, v_t_lng from public.saga_zones where id = p_target;
  if v_o_lat is null or v_t_lat is null then return 600; end if;

  -- Haversine vereinfacht
  v_dist_km := sqrt(
    power((v_t_lat - v_o_lat) * 111.0, 2) +
    power((v_t_lng - v_o_lng) * 111.0 * cos(radians((v_o_lat + v_t_lat)/2)), 2)
  );
  v_seconds := greatest(60, least(14400, (v_dist_km * 60)::int));
  return v_seconds;
end $$;

-- Hauptgebäude-Kosten skalieren exponentiell mit Anzahl bereits gebauter
create or replace function public._saga_hauptgebaeude_cost(p_existing_count int)
returns table (tech_schrott bigint, komponenten bigint) language sql immutable as $$
  select
    (1000 * power(3, p_existing_count))::bigint,
    (500  * power(3, p_existing_count))::bigint
$$;

-- ════════════════════════════════════════════════════════════════
-- LIFECYCLE: signup_crew
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_signup_crew(p_round_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_role text;
  v_round_status text;
  v_member_count int;
  v_power bigint;
begin
  if v_user is null then
    return query select false, 'not_authenticated'; return;
  end if;

  select cm.crew_id, cm.role into v_crew_id, v_role
    from public.crew_members cm
   where cm.user_id = v_user
   limit 1;

  if v_crew_id is null then
    return query select false, 'no_crew'; return;
  end if;
  if v_role not in ('leader','officer') then
    return query select false, 'not_leader_or_officer'; return;
  end if;

  select status into v_round_status from public.saga_rounds where id = p_round_id;
  if v_round_status is null then
    return query select false, 'round_not_found'; return;
  end if;
  if v_round_status != 'signup' then
    return query select false, 'signup_closed'; return;
  end if;

  select count(*) into v_member_count from public.crew_members where crew_id = v_crew_id;
  select coalesce(power_score, 0) into v_power from public.crews where id = v_crew_id;

  insert into public.saga_signups (round_id, crew_id, signed_up_by, member_count_at_signup, power_score_at_signup)
  values (p_round_id, v_crew_id, v_user, v_member_count, v_power)
  on conflict (round_id, crew_id) do nothing;

  return query select true, 'signed_up';
end $$;

grant execute on function public.saga_signup_crew(uuid) to authenticated;

create or replace function public.saga_withdraw_crew(p_round_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_round_status text;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;

  select crew_id into v_crew_id from public.crew_members
   where user_id = v_user and role in ('leader','officer') limit 1;
  if v_crew_id is null then return query select false, 'not_leader'; return; end if;

  select status into v_round_status from public.saga_rounds where id = p_round_id;
  if v_round_status != 'signup' then return query select false, 'signup_closed'; return; end if;

  delete from public.saga_signups where round_id = p_round_id and crew_id = v_crew_id;
  return query select true, 'withdrawn';
end $$;

grant execute on function public.saga_withdraw_crew(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- LIFECYCLE: run_matchmaking
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_run_matchmaking(p_round_id uuid)
returns table (brackets_created int, crews_matched int)
language plpgsql security definer set search_path = public as $$
declare
  v_round public.saga_rounds%rowtype;
  v_signup record;
  v_bracket_id uuid;
  v_size_tier text;
  v_target_size int;
  v_current_size int := 0;
  v_brackets_created int := 0;
  v_crews_matched int := 0;
  v_city_slug text;
  v_color_idx int;
  v_colors text[] := array['#FF2D78','#22D1C3','#FFD700','#A855F7','#5DDAF0','#4ADE80','#FB923C','#F472B6'];
begin
  select * into v_round from public.saga_rounds where id = p_round_id;
  if v_round.id is null or v_round.status != 'matchmaking' then
    return query select 0, 0; return;
  end if;

  -- Loop über alle 4 Größen-Klassen
  for v_size_tier, v_target_size in
    select * from (values
      ('mini', 4),
      ('mid',  4),
      ('big',  6),
      ('mega', 8)
    ) as t(tier, sz)
  loop
    v_current_size := 0;
    v_bracket_id := null;
    v_color_idx := 1;

    -- Crews der aktuellen Größenklasse, sortiert nach Power für Bracket-Bildung
    for v_signup in
      select s.* from public.saga_signups s
       where s.round_id = p_round_id
         and s.bracket_id is null
         and case
               when v_size_tier = 'mini' then s.member_count_at_signup between 1 and 10
               when v_size_tier = 'mid'  then s.member_count_at_signup between 11 and 25
               when v_size_tier = 'big'  then s.member_count_at_signup between 26 and 50
               when v_size_tier = 'mega' then s.member_count_at_signup > 50
             end
       order by s.power_score_at_signup desc
    loop
      -- Neues Bracket wenn aktuelles voll oder noch keins
      if v_bracket_id is null or v_current_size >= v_target_size then
        select slug into v_city_slug
          from public.saga_city_pool
         where size_tier = v_size_tier and enabled = true
         order by random() limit 1;

        if v_city_slug is null then
          continue; -- keine Stadt verfügbar
        end if;

        insert into public.saga_brackets (round_id, city_slug, size_tier, crew_count, status)
        values (p_round_id, v_city_slug, v_size_tier, 0, 'auftakt')
        returning id into v_bracket_id;
        v_brackets_created := v_brackets_created + 1;
        v_current_size := 0;
        v_color_idx := 1;
      end if;

      update public.saga_signups
         set bracket_id = v_bracket_id
       where round_id = p_round_id and crew_id = v_signup.crew_id;

      insert into public.saga_bracket_crews (bracket_id, crew_id, color_hex)
      values (v_bracket_id, v_signup.crew_id, v_colors[((v_color_idx - 1) % 8) + 1]);

      update public.saga_brackets set crew_count = crew_count + 1 where id = v_bracket_id;
      v_current_size := v_current_size + 1;
      v_color_idx := v_color_idx + 1;
      v_crews_matched := v_crews_matched + 1;
    end loop;
  end loop;

  -- Round als active markieren (Map-Generation läuft via Edge Function/Admin-Endpoint)
  update public.saga_rounds set status = 'active' where id = p_round_id;

  return query select v_brackets_created, v_crews_matched;
end $$;

grant execute on function public.saga_run_matchmaking(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════
-- LIFECYCLE: advance_phases (Cron)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_advance_phases()
returns table (bracket_id uuid, new_phase int, gates_opened int)
language plpgsql security definer set search_path = public as $$
declare
  v_bracket public.saga_brackets%rowtype;
  v_round public.saga_rounds%rowtype;
  v_now timestamptz := now();
  v_target_phase int;
  v_days_into_main numeric;
  v_gates_opened int;
begin
  for v_bracket in
    select * from public.saga_brackets where status in ('auftakt','main')
  loop
    select * into v_round from public.saga_rounds where id = v_bracket.round_id;

    -- Auftakt → main nach Auftakt-Ende, Auftakt-Sieger küren
    if v_bracket.status = 'auftakt' and v_round.auftakt_ends <= v_now then
      -- Auftakt-Sieger = Crew mit höchsten auftakt_points
      update public.saga_brackets
         set status = 'main',
             buildup_winner_crew_id = (
               select crew_id from public.saga_bracket_crews
                where bracket_id = v_bracket.id
                order by auftakt_points desc nulls last
                limit 1
             )
       where id = v_bracket.id;

      insert into public.saga_progress_log (bracket_id, event_kind, payload)
      values (v_bracket.id, 'main_phase_started', jsonb_build_object('at', v_now));
      continue;
    end if;

    -- Main-Phase: Tore öffnen basierend auf Tagen seit main-Start
    if v_bracket.status = 'main' then
      v_days_into_main := extract(epoch from (v_now - v_round.auftakt_ends)) / 86400.0;
      v_target_phase := case
        when v_days_into_main >= 21 then 4   -- Tag 22+: Phase 4 (Apex zugänglich)
        when v_days_into_main >= 14 then 3   -- Tag 15-21: Phase 3
        when v_days_into_main >=  7 then 2   -- Tag 8-14: Phase 2
        when v_days_into_main >=  0 then 1   -- Tag 1-7: Phase 1
        else 0
      end;

      if v_target_phase > v_bracket.current_phase then
        -- Tore mit gate_phase = v_target_phase auf 'open' setzen
        update public.saga_zones
           set gate_state = 'open'
         where bracket_id = v_bracket.id
           and zone_kind = 'gate'
           and gate_phase = v_target_phase
           and gate_state = 'closed';
        get diagnostics v_gates_opened = row_count;

        update public.saga_brackets
           set current_phase = v_target_phase
         where id = v_bracket.id;

        insert into public.saga_progress_log (bracket_id, event_kind, payload)
        values (v_bracket.id, 'phase_advance',
                jsonb_build_object('phase', v_target_phase, 'gates_opened', v_gates_opened));

        return query select v_bracket.id, v_target_phase, v_gates_opened;
      end if;

      -- Wenn main_ends erreicht: in apex_hold
      if v_round.main_ends <= v_now then
        update public.saga_brackets set status = 'apex_hold' where id = v_bracket.id;
        insert into public.saga_progress_log (bracket_id, event_kind, payload)
        values (v_bracket.id, 'apex_hold_started', jsonb_build_object('at', v_now));
      end if;
    end if;
  end loop;
end $$;

grant execute on function public.saga_advance_phases() to service_role;

-- ════════════════════════════════════════════════════════════════
-- AKTION: build_repeater
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_build_repeater(p_zone_id uuid)
returns table (ok boolean, message text, building_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_zone public.saga_zones%rowtype;
  v_bracket public.saga_brackets%rowtype;
  v_member boolean;
  v_existing_count int;
  v_adj_owned boolean;
  v_new_id uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid; return; end if;

  select * into v_zone from public.saga_zones where id = p_zone_id;
  if v_zone.id is null then return query select false, 'zone_not_found', null::uuid; return; end if;

  select * into v_bracket from public.saga_brackets where id = v_zone.bracket_id;
  if v_bracket.status not in ('auftakt','main','apex_hold') then
    return query select false, 'bracket_inactive', null::uuid; return;
  end if;

  -- Crew muss im Bracket sein
  select exists(select 1 from public.saga_bracket_crews
                 where bracket_id = v_bracket.id and crew_id = v_crew_id) into v_member;
  if not v_member then return query select false, 'crew_not_in_bracket', null::uuid; return; end if;

  -- Zone-Kind: nur district + spawn (nicht Tor, nicht Apex)
  if v_zone.zone_kind not in ('district','spawn') then
    return query select false, 'zone_not_buildable', null::uuid; return;
  end if;

  -- Connection-Regel: Spawn-Zone ohne Check, sonst muss eine angrenzende Zone der Crew gehören
  if v_zone.zone_kind != 'spawn' then
    select exists(
      select 1 from public.saga_zone_adjacency adj
        join public.saga_zones z on z.id = case when adj.zone_a = p_zone_id then adj.zone_b else adj.zone_a end
       where (adj.zone_a = p_zone_id or adj.zone_b = p_zone_id)
         and (z.owner_crew_id = v_crew_id or z.zone_kind = 'spawn')
         -- Wenn via_gate_zone gesetzt: Tor muss offen sein
         and (adj.via_gate_zone is null or exists(
               select 1 from public.saga_zones g
                where g.id = adj.via_gate_zone and g.gate_state in ('open','garrisoned')
             ))
    ) into v_adj_owned;
    if not v_adj_owned then
      return query select false, 'no_adjacent_owned_zone', null::uuid; return;
    end if;
  end if;

  -- Existiert bereits ein Repeater dieser Crew in der Zone?
  if exists(select 1 from public.saga_buildings
             where zone_id = p_zone_id and crew_id = v_crew_id
               and building_kind = 'repeater' and destroyed_at is null) then
    return query select false, 'already_has_repeater', null::uuid; return;
  end if;

  insert into public.saga_buildings (zone_id, bracket_id, crew_id, built_by_user_id, building_kind, hp, max_hp)
  values (p_zone_id, v_bracket.id, v_crew_id, v_user, 'repeater', 1000, 1000)
  returning id into v_new_id;

  -- Wenn Zone noch keinen Owner hat: jetzt Crew zuweisen
  if v_zone.owner_crew_id is null then
    update public.saga_zones set owner_crew_id = v_crew_id where id = p_zone_id;
    update public.saga_bracket_crews
       set zones_held = zones_held + 1
     where bracket_id = v_bracket.id and crew_id = v_crew_id;
  end if;

  update public.saga_bracket_crews
     set buildings_count = buildings_count + 1,
         merits = merits + 50
   where bracket_id = v_bracket.id and crew_id = v_crew_id;

  insert into public.saga_user_merits (user_id, bracket_id, merits)
  values (v_user, v_bracket.id, 50)
  on conflict (user_id, bracket_id) do update set merits = saga_user_merits.merits + 50;

  return query select true, 'built', v_new_id;
end $$;

grant execute on function public.saga_build_repeater(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- AKTION: build_hauptgebaeude
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_build_hauptgebaeude(p_zone_id uuid)
returns table (ok boolean, message text, building_id uuid, cost_tech bigint, cost_komp bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_zone public.saga_zones%rowtype;
  v_bracket public.saga_brackets%rowtype;
  v_existing_count int;
  v_cost record;
  v_new_id uuid;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid, 0::bigint, 0::bigint; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid, 0::bigint, 0::bigint; return; end if;

  select * into v_zone from public.saga_zones where id = p_zone_id;
  if v_zone.id is null then return query select false, 'zone_not_found', null::uuid, 0::bigint, 0::bigint; return; end if;
  if v_zone.owner_crew_id != v_crew_id then
    return query select false, 'zone_not_owned', null::uuid, 0::bigint, 0::bigint; return;
  end if;

  select * into v_bracket from public.saga_brackets where id = v_zone.bracket_id;
  if v_bracket.status not in ('main','apex_hold') then
    return query select false, 'bracket_inactive', null::uuid, 0::bigint, 0::bigint; return;
  end if;

  if exists(select 1 from public.saga_buildings
             where zone_id = p_zone_id and building_kind = 'hauptgebaeude' and destroyed_at is null) then
    return query select false, 'already_has_hauptgebaeude', null::uuid, 0::bigint, 0::bigint; return;
  end if;

  select count(*) into v_existing_count from public.saga_buildings
   where bracket_id = v_bracket.id and crew_id = v_crew_id
     and building_kind = 'hauptgebaeude' and destroyed_at is null;
  select * into v_cost from public._saga_hauptgebaeude_cost(v_existing_count);

  -- TODO: Ressourcen-Abzug aus Crew-Konto (existierendes Crew-Resources-System)
  -- Hier nur Building-Insert, Resource-Check kommt im API-Layer

  insert into public.saga_buildings (zone_id, bracket_id, crew_id, built_by_user_id, building_kind, hp, max_hp)
  values (p_zone_id, v_bracket.id, v_crew_id, v_user, 'hauptgebaeude', 10000, 10000)
  returning id into v_new_id;

  insert into public.saga_garrisons (building_id) values (v_new_id);

  update public.saga_bracket_crews
     set buildings_count = buildings_count + 1,
         merits = merits + 500
   where bracket_id = v_bracket.id and crew_id = v_crew_id;

  insert into public.saga_user_merits (user_id, bracket_id, merits)
  values (v_user, v_bracket.id, 500)
  on conflict (user_id, bracket_id) do update set merits = saga_user_merits.merits + 500;

  return query select true, 'built', v_new_id, v_cost.tech_schrott, v_cost.komponenten;
end $$;

grant execute on function public.saga_build_hauptgebaeude(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- AKTION: start_march
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_start_march(
  p_origin_zone_id uuid,
  p_target_zone_id uuid,
  p_kind text,           -- 'attack' / 'reinforce' / 'gather'
  p_inf int, p_cav int, p_mark int, p_werk int,
  p_guardian_id uuid default null
)
returns table (ok boolean, message text, march_id uuid, arrives_in_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_origin public.saga_zones%rowtype;
  v_target public.saga_zones%rowtype;
  v_bracket public.saga_brackets%rowtype;
  v_state public.saga_user_state%rowtype;
  v_seconds int;
  v_arrives timestamptz;
  v_new_id uuid;
  v_total_troops int;
begin
  if v_user is null then return query select false, 'not_authenticated', null::uuid, 0; return; end if;
  if p_kind not in ('attack','reinforce','gather') then
    return query select false, 'bad_kind', null::uuid, 0; return;
  end if;

  v_total_troops := coalesce(p_inf,0) + coalesce(p_cav,0) + coalesce(p_mark,0) + coalesce(p_werk,0);
  if v_total_troops <= 0 then return query select false, 'no_troops', null::uuid, 0; return; end if;

  select crew_id into v_crew_id from public.crew_members where user_id = v_user limit 1;
  if v_crew_id is null then return query select false, 'no_crew', null::uuid, 0; return; end if;

  select * into v_origin from public.saga_zones where id = p_origin_zone_id;
  select * into v_target from public.saga_zones where id = p_target_zone_id;
  if v_origin.id is null or v_target.id is null then
    return query select false, 'zone_not_found', null::uuid, 0; return;
  end if;
  if v_origin.bracket_id != v_target.bracket_id then
    return query select false, 'cross_bracket', null::uuid, 0; return;
  end if;

  -- Origin: muss eigene Spawn-Zone oder eigenes Hauptgebäude sein
  if v_origin.zone_kind = 'spawn' and v_origin.owner_crew_id != v_crew_id then
    -- Spawn-Zonen sind crew-spezifisch via spawn_zone_id im bracket_crews
    if not exists(select 1 from public.saga_bracket_crews
                   where bracket_id = v_origin.bracket_id
                     and crew_id = v_crew_id
                     and spawn_zone_id = v_origin.id) then
      return query select false, 'origin_not_owned', null::uuid, 0; return;
    end if;
  elsif v_origin.zone_kind != 'spawn' then
    if not exists(select 1 from public.saga_buildings
                   where zone_id = v_origin.id and crew_id = v_crew_id
                     and building_kind = 'hauptgebaeude' and destroyed_at is null) then
      return query select false, 'origin_no_hauptgebaeude', null::uuid, 0; return;
    end if;
  end if;

  select * into v_bracket from public.saga_brackets where id = v_origin.bracket_id;
  if v_bracket.status not in ('main','apex_hold') then
    return query select false, 'bracket_not_active', null::uuid, 0; return;
  end if;

  -- Marsch-Slots prüfen
  select * into v_state from public.saga_user_state where user_id = v_user;
  if v_state.user_id is null then
    insert into public.saga_user_state (user_id, bracket_id, march_slots_total, march_slots_used)
    values (v_user, v_bracket.id, 3, 0);
    select * into v_state from public.saga_user_state where user_id = v_user;
  end if;
  if v_state.march_slots_used >= v_state.march_slots_total then
    return query select false, 'no_march_slots', null::uuid, 0; return;
  end if;

  v_seconds := public._saga_calc_march_seconds(p_origin_zone_id, p_target_zone_id);
  v_arrives := now() + (v_seconds || ' seconds')::interval;

  insert into public.saga_marches (
    bracket_id, crew_id, user_id, origin_zone_id, target_zone_id, march_kind,
    inf, cav, mark, werk, guardian_id, arrives_at
  ) values (
    v_bracket.id, v_crew_id, v_user, p_origin_zone_id, p_target_zone_id, p_kind,
    p_inf, p_cav, p_mark, p_werk, p_guardian_id, v_arrives
  ) returning id into v_new_id;

  update public.saga_user_state
     set march_slots_used = march_slots_used + 1,
         saga_slot_inf  = saga_slot_inf  + p_inf,
         saga_slot_cav  = saga_slot_cav  + p_cav,
         saga_slot_mark = saga_slot_mark + p_mark,
         saga_slot_werk = saga_slot_werk + p_werk,
         updated_at = now()
   where user_id = v_user;

  return query select true, 'marching', v_new_id, v_seconds;
end $$;

grant execute on function public.saga_start_march(uuid, uuid, text, int, int, int, int, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- AKTION: recall_march
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_recall_march(p_march_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_march public.saga_marches%rowtype;
begin
  if v_user is null then return query select false, 'not_authenticated'; return; end if;

  select * into v_march from public.saga_marches where id = p_march_id;
  if v_march.id is null or v_march.user_id != v_user then
    return query select false, 'not_yours'; return;
  end if;
  if v_march.status != 'marching' then return query select false, 'cannot_recall'; return; end if;

  -- Recall = neuer Marsch zurück, dauert gleich lang wie bisher zurückgelegte Strecke
  -- Vereinfachung: wir setzen arrives_at = now() + verbleibende Zeit
  update public.saga_marches
     set status = 'recalled',
         resolved_at = now()
   where id = p_march_id;

  -- Truppen kehren ZURÜCK: vereinfacht direkt freisetzen
  update public.saga_user_state
     set march_slots_used = greatest(0, march_slots_used - 1),
         saga_slot_inf  = greatest(0, saga_slot_inf  - v_march.inf),
         saga_slot_cav  = greatest(0, saga_slot_cav  - v_march.cav),
         saga_slot_mark = greatest(0, saga_slot_mark - v_march.mark),
         saga_slot_werk = greatest(0, saga_slot_werk - v_march.werk),
         updated_at = now()
   where user_id = v_user;

  return query select true, 'recalled';
end $$;

grant execute on function public.saga_recall_march(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- CRON: resolve_arrived_marches
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_resolve_arrived_marches()
returns table (resolved int, battles int)
language plpgsql security definer set search_path = public as $$
declare
  v_march public.saga_marches%rowtype;
  v_target public.saga_zones%rowtype;
  v_def_garrison record;
  v_atk_strength numeric;
  v_def_strength numeric;
  v_atk_wins boolean;
  v_atk_loss_pct numeric;
  v_def_loss_pct numeric;
  v_resolved int := 0;
  v_battles_count int := 0;
  v_battle_id uuid;
  v_dead int; v_wounded int;
begin
  for v_march in
    select * from public.saga_marches
     where status = 'marching' and arrives_at <= now()
     order by arrives_at asc
     limit 500
  loop
    update public.saga_marches set status = 'arrived' where id = v_march.id;
    select * into v_target from public.saga_zones where id = v_march.target_zone_id;

    -- Reinforce: Truppen in eigene Garnison verschmelzen, kein Kampf
    if v_march.march_kind = 'reinforce' and v_target.owner_crew_id = v_march.crew_id then
      -- TODO: in Garrison verschmelzen (vereinfacht: zurück zum User-Pool)
      update public.saga_user_state
         set march_slots_used = greatest(0, march_slots_used - 1)
       where user_id = v_march.user_id;
      update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
      v_resolved := v_resolved + 1;
      continue;
    end if;

    -- Attack: Kampf-Resolution
    if v_march.march_kind = 'attack' then
      v_atk_strength :=
        v_march.inf * 1.0 + v_march.cav * 1.5 + v_march.mark * 1.3 + v_march.werk * 1.2;

      -- Verteidiger-Truppen aus allen Garrisons der Ziel-Zone summieren
      select
        coalesce(sum(g.inf), 0) as inf,
        coalesce(sum(g.cav), 0) as cav,
        coalesce(sum(g.mark), 0) as mark,
        coalesce(sum(g.werk), 0) as werk
        into v_def_garrison
        from public.saga_buildings b
        join public.saga_garrisons g on g.building_id = b.id
       where b.zone_id = v_march.target_zone_id and b.destroyed_at is null;

      v_def_strength :=
        coalesce(v_def_garrison.inf,0) * 1.1 + coalesce(v_def_garrison.cav,0) * 1.5
        + coalesce(v_def_garrison.mark,0) * 1.4 + coalesce(v_def_garrison.werk,0) * 1.3;

      v_atk_wins := v_atk_strength > v_def_strength * 0.9;

      if v_atk_wins then
        v_atk_loss_pct := least(0.3, v_def_strength / nullif(v_atk_strength, 0));
        v_def_loss_pct := 0.85;
      else
        v_atk_loss_pct := 0.85;
        v_def_loss_pct := least(0.3, v_atk_strength / nullif(v_def_strength, 0));
      end if;

      insert into public.saga_battles (
        bracket_id, zone_id, attacker_crew_id, defender_crew_id, attacker_user_id,
        attacker_inf, attacker_cav, attacker_mark, attacker_werk,
        defender_inf, defender_cav, defender_mark, defender_werk,
        attacker_losses_dead, attacker_losses_wounded,
        defender_losses_dead, defender_losses_wounded,
        outcome
      ) values (
        v_march.bracket_id, v_march.target_zone_id, v_march.crew_id, v_target.owner_crew_id, v_march.user_id,
        v_march.inf, v_march.cav, v_march.mark, v_march.werk,
        coalesce(v_def_garrison.inf,0), coalesce(v_def_garrison.cav,0),
        coalesce(v_def_garrison.mark,0), coalesce(v_def_garrison.werk,0),
        round((v_march.inf + v_march.cav + v_march.mark + v_march.werk) * v_atk_loss_pct * 0.5)::int,
        round((v_march.inf + v_march.cav + v_march.mark + v_march.werk) * v_atk_loss_pct * 0.5)::int,
        round((coalesce(v_def_garrison.inf,0) + coalesce(v_def_garrison.cav,0)
             + coalesce(v_def_garrison.mark,0) + coalesce(v_def_garrison.werk,0)) * v_def_loss_pct * 0.3)::int,
        round((coalesce(v_def_garrison.inf,0) + coalesce(v_def_garrison.cav,0)
             + coalesce(v_def_garrison.mark,0) + coalesce(v_def_garrison.werk,0)) * v_def_loss_pct * 0.7)::int,
        case when v_atk_wins then 'attacker_won' else 'defender_won' end
      ) returning id into v_battle_id;
      v_battles_count := v_battles_count + 1;

      -- Wenn Angreifer gewinnt: Buildings zerstören + Zone übernehmen
      if v_atk_wins then
        update public.saga_buildings
           set hp = 0, destroyed_at = now()
         where zone_id = v_march.target_zone_id
           and crew_id = v_target.owner_crew_id
           and destroyed_at is null;

        update public.saga_zones
           set owner_crew_id = v_march.crew_id
         where id = v_march.target_zone_id;

        update public.saga_bracket_crews
           set zones_held = zones_held + 1,
               merits = merits + 200
         where bracket_id = v_march.bracket_id and crew_id = v_march.crew_id;

        if v_target.owner_crew_id is not null then
          update public.saga_bracket_crews
             set zones_held = greatest(0, zones_held - 1)
           where bracket_id = v_march.bracket_id and crew_id = v_target.owner_crew_id;
        end if;

        -- Apex-Eroberung?
        if v_target.zone_kind = 'apex' then
          update public.saga_brackets
             set apex_holder_crew_id = v_march.crew_id,
                 apex_hold_started_at = now()
           where id = v_march.bracket_id;
          insert into public.saga_progress_log (bracket_id, crew_id, event_kind, payload)
          values (v_march.bracket_id, v_march.crew_id, 'apex_taken', jsonb_build_object('zone', v_march.target_zone_id));
        end if;

        insert into public.saga_progress_log (bracket_id, crew_id, event_kind, payload)
        values (v_march.bracket_id, v_march.crew_id, 'zone_captured',
                jsonb_build_object('zone', v_march.target_zone_id, 'zone_name', v_target.name));
      end if;

      -- Truppen-Verluste in Lazarett (vereinfacht: alle wounded statt teils dead)
      v_dead := round((v_march.inf + v_march.cav + v_march.mark + v_march.werk) * v_atk_loss_pct * 0.5)::int;
      v_wounded := round((v_march.inf + v_march.cav + v_march.mark + v_march.werk) * v_atk_loss_pct * 0.5)::int;
      insert into public.saga_lazarett (user_id, bracket_id, inf, cav, mark, werk)
      values (v_march.user_id, v_march.bracket_id,
              round(v_march.inf  * v_atk_loss_pct * 0.5)::int,
              round(v_march.cav  * v_atk_loss_pct * 0.5)::int,
              round(v_march.mark * v_atk_loss_pct * 0.5)::int,
              round(v_march.werk * v_atk_loss_pct * 0.5)::int)
      on conflict (user_id, bracket_id) do update set
        inf  = saga_lazarett.inf  + excluded.inf,
        cav  = saga_lazarett.cav  + excluded.cav,
        mark = saga_lazarett.mark + excluded.mark,
        werk = saga_lazarett.werk + excluded.werk;

      update public.saga_bracket_crews
         set troops_lost = troops_lost + v_dead
       where bracket_id = v_march.bracket_id and crew_id = v_march.crew_id;
    end if;

    update public.saga_user_state
       set march_slots_used = greatest(0, march_slots_used - 1)
     where user_id = v_march.user_id;

    update public.saga_marches set status = 'resolved', resolved_at = now() where id = v_march.id;
    v_resolved := v_resolved + 1;
  end loop;

  return query select v_resolved, v_battles_count;
end $$;

grant execute on function public.saga_resolve_arrived_marches() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: check_apex_holds
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_check_apex_holds()
returns table (bracket_id uuid, winner_crew_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_bracket public.saga_brackets%rowtype;
begin
  for v_bracket in
    select * from public.saga_brackets
     where status in ('main','apex_hold')
       and apex_holder_crew_id is not null
       and apex_hold_started_at is not null
       and apex_hold_started_at <= now() - interval '48 hours'
  loop
    update public.saga_brackets
       set status = 'finalized',
           winner_crew_id = v_bracket.apex_holder_crew_id
     where id = v_bracket.id;

    insert into public.saga_progress_log (bracket_id, crew_id, event_kind, payload)
    values (v_bracket.id, v_bracket.apex_holder_crew_id, 'saga_won',
            jsonb_build_object('reason', 'apex_held_48h'));

    return query select v_bracket.id, v_bracket.apex_holder_crew_id;
  end loop;
end $$;

grant execute on function public.saga_check_apex_holds() to service_role;

-- ════════════════════════════════════════════════════════════════
-- CRON: finalize_brackets (verteilt Rewards)
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_finalize_brackets()
returns table (bracket_id uuid, users_rewarded int)
language plpgsql security definer set search_path = public as $$
declare
  v_bracket public.saga_brackets%rowtype;
  v_round public.saga_rounds%rowtype;
  v_crew record;
  v_rank int;
  v_reward record;
  v_member record;
  v_users_rewarded int;
begin
  for v_bracket in
    select b.* from public.saga_brackets b
     join public.saga_rounds r on r.id = b.round_id
     where b.status = 'finalized'
       and r.awards_ends > now()
       and not exists(select 1 from public.saga_bracket_crews bc where bc.bracket_id = b.id and bc.final_rank is not null)
  loop
    v_users_rewarded := 0;
    v_rank := 0;
    for v_crew in
      select * from public.saga_bracket_crews
       where bracket_id = v_bracket.id
       order by
         case when crew_id = v_bracket.winner_crew_id then 0 else 1 end,
         zones_held desc,
         buildings_count desc,
         merits desc
    loop
      v_rank := v_rank + 1;
      update public.saga_bracket_crews set final_rank = v_rank
       where bracket_id = v_bracket.id and crew_id = v_crew.crew_id;

      select * into v_reward from public.season_reward_for_rank('saga', v_rank, true);
      if v_reward.gems is not null and v_reward.gems > 0 then
        for v_member in
          select user_id from public.crew_members where crew_id = v_crew.crew_id
        loop
          update public.users
             set gems = coalesce(gems,0) + v_reward.gems
           where id = v_member.user_id;
          v_users_rewarded := v_users_rewarded + 1;
        end loop;
      end if;
    end loop;

    return query select v_bracket.id, v_users_rewarded;
  end loop;
end $$;

grant execute on function public.saga_finalize_brackets() to service_role;
