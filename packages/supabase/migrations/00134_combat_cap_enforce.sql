-- ════════════════════════════════════════════════════════════════════
-- COMBAT CAP-ENFORCE + KLASSEN-COUNTER (server-side Härtung)
-- ════════════════════════════════════════════════════════════════════
-- Erweitert die Attack/Rally-RPCs um:
--   1) Server-side march_capacity-Check (Client kann nicht overriden)
--   2) march_queue-Check (max parallele Marches)
--   3) Klassen-Counter-Multiplikator in Damage:
--      Schleuderer 1.5× vs Türsteher, Türsteher 1.5× vs Kuriere,
--      Kuriere 1.5× vs Schleuderer, Brecher 2× vs Strukturen
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Helper: Schaden-Berechnung mit Klassen-Counter ──────────────
-- Berechnet Roh-ATK eines troops-jsonb mit Counter-Bonus gegen Defender-Class.
-- Wenn p_target_class is null (= Strukturen wie Repeater/Base): Brecher bekommen 2×.
create or replace function public._calc_atk_with_counters(p_troops jsonb, p_target_class text default null)
returns bigint language plpgsql immutable as $$
declare
  v_atk bigint := 0;
  k text;
  v int;
  v_t record;
  v_mult numeric;
begin
  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    select troop_class, base_atk into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;

    v_mult := 1.0;
    -- Counter-Matrix
    if p_target_class is null then
      -- vs Struktur (Repeater/Base): Brecher 2×, andere normal
      if v_t.troop_class = 'siege' then v_mult := 2.0; end if;
    else
      if v_t.troop_class = 'marksman' and p_target_class = 'infantry' then v_mult := 1.5;
      elsif v_t.troop_class = 'infantry' and p_target_class = 'cavalry' then v_mult := 1.5;
      elsif v_t.troop_class = 'cavalry'  and p_target_class = 'marksman' then v_mult := 1.5;
      end if;
    end if;

    v_atk := v_atk + ((v::int) * v_t.base_atk * v_mult)::bigint;
  end loop;
  return v_atk;
end $$;

-- ─── 2) Helper: Truppen-Total zählen ────────────────────────────────
create or replace function public._sum_troops(p_troops jsonb)
returns int language sql immutable as $$
  select coalesce(sum((value::int)), 0)::int
    from jsonb_each_text(p_troops)
   where (value::int) > 0;
$$;

-- ─── 3) Cap-Guard: Wirft exception wenn over_cap oder queue_full ─────
create or replace function public._enforce_march_caps(p_user_id uuid, p_troops jsonb)
returns void language plpgsql security definer as $$
declare
  v_caps record;
  v_active int;
  v_total int;
begin
  select * into v_caps from public.get_march_caps(p_user_id) limit 1;
  v_active := public.count_active_marches(p_user_id);
  v_total := public._sum_troops(p_troops);

  if v_active >= v_caps.march_queue then
    raise exception 'queue_full' using errcode = 'P0001';
  end if;
  if v_total > v_caps.march_capacity then
    raise exception 'over_march_cap' using errcode = 'P0001', detail = format('sent %s, max %s', v_total, v_caps.march_capacity);
  end if;
end $$;

-- ─── 4) attack_crew_repeater — Cap-Enforce + Counter (Brecher 2×) ───
create or replace function public.attack_crew_repeater(
  p_repeater_id uuid,
  p_troops jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid;
  v_repeater record;
  v_atk bigint;
  v_arrival timestamptz;
  v_attack_id uuid;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select crew_id into v_my_crew from public.crew_members where user_id = v_user limit 1;

  select id, crew_id, kind, hp, max_hp, shield_until, lat, lng
    into v_repeater
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null;
  if v_repeater is null then return jsonb_build_object('ok', false, 'error', 'repeater_not_found'); end if;
  if v_my_crew is not null and v_repeater.crew_id = v_my_crew then
    return jsonb_build_object('ok', false, 'error', 'cannot_attack_own_crew');
  end if;
  if v_repeater.shield_until is not null and v_repeater.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'shielded', 'shield_until', v_repeater.shield_until);
  end if;
  if jsonb_typeof(p_troops) <> 'object' then return jsonb_build_object('ok', false, 'error', 'troops_invalid'); end if;

  -- CAP-ENFORCE
  begin
    perform public._enforce_march_caps(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  -- Truppen-Verfügbarkeit + Abzug
  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (
      select 1 from public.user_troops
       where user_id = v_user and troop_id = k and count >= (v::int)
    ) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
  end loop;

  -- ATK mit Counter (Repeater = Struktur, also p_target_class=null → Brecher 2×)
  v_atk := public._calc_atk_with_counters(p_troops, null);
  if v_atk = 0 then return jsonb_build_object('ok', false, 'error', 'no_troops_sent'); end if;

  v_arrival := now() + interval '60 seconds';

  insert into public.crew_repeater_attacks (
    attacker_user_id, attacker_crew_id, repeater_id, troops_sent, total_atk, arrival_at
  ) values (
    v_user, v_my_crew, p_repeater_id, p_troops, v_atk, v_arrival
  ) returning id into v_attack_id;

  return jsonb_build_object('ok', true, 'attack_id', v_attack_id, 'arrival_at', v_arrival, 'total_atk', v_atk);
end $$;

-- ─── 5) start_crew_repeater_rally — Cap-Enforce + Counter ───────────
create or replace function public.start_crew_repeater_rally(
  p_repeater_id uuid,
  p_prep_seconds int,
  p_troops jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_repeater record;
  v_rally_id uuid;
  v_atk bigint;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_prep_seconds not in (180, 480, 1680) then return jsonb_build_object('ok', false, 'error', 'bad_prep'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select id, crew_id, hp, kind, label, shield_until into v_repeater
    from public.crew_repeaters where id = p_repeater_id and destroyed_at is null;
  if v_repeater is null then return jsonb_build_object('ok', false, 'error', 'repeater_not_found'); end if;
  if v_repeater.crew_id = v_crew then return jsonb_build_object('ok', false, 'error', 'cannot_attack_own_crew'); end if;
  if v_repeater.shield_until is not null and v_repeater.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'shielded');
  end if;

  if exists (
    select 1 from public.crew_repeater_rallies
     where attacker_crew_id = v_crew and status in ('preparing','marching','fighting')
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_active_rally');
  end if;

  -- CAP-ENFORCE
  begin
    perform public._enforce_march_caps(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (select 1 from public.user_troops where user_id = v_user and troop_id = k and count >= (v::int)) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
  end loop;

  v_atk := public._calc_atk_with_counters(p_troops, null);
  if v_atk = 0 then return jsonb_build_object('ok', false, 'error', 'no_troops_sent'); end if;

  insert into public.crew_repeater_rallies (
    leader_user_id, attacker_crew_id, repeater_id, prep_seconds,
    prep_ends_at, total_atk
  ) values (
    v_user, v_crew, p_repeater_id, p_prep_seconds,
    now() + (p_prep_seconds || ' seconds')::interval, v_atk
  ) returning id into v_rally_id;

  insert into public.crew_repeater_rally_participants (rally_id, user_id, troops_sent, troop_atk)
  values (v_rally_id, v_user, p_troops, v_atk);

  return jsonb_build_object('ok', true, 'rally_id', v_rally_id, 'prep_ends_at', (now() + (p_prep_seconds||' seconds')::interval));
end $$;

-- ─── 6) join_crew_repeater_rally — Cap-Enforce ──────────────────────
create or replace function public.join_crew_repeater_rally(
  p_rally_id uuid, p_troops jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  v_atk bigint;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select * into r from public.crew_repeater_rallies where id = p_rally_id;
  if r is null or r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'rally_closed'); end if;
  if r.prep_ends_at <= now() then return jsonb_build_object('ok', false, 'error', 'prep_over'); end if;
  if not exists (select 1 from public.crew_members where crew_id = r.attacker_crew_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'not_in_crew');
  end if;
  if exists (select 1 from public.crew_repeater_rally_participants where rally_id = p_rally_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;

  begin
    perform public._enforce_march_caps(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (select 1 from public.user_troops where user_id = v_user and troop_id = k and count >= (v::int)) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
  end loop;

  v_atk := public._calc_atk_with_counters(p_troops, null);
  if v_atk = 0 then return jsonb_build_object('ok', false, 'error', 'no_troops_sent'); end if;

  insert into public.crew_repeater_rally_participants (rally_id, user_id, troops_sent, troop_atk)
  values (p_rally_id, v_user, p_troops, v_atk);
  update public.crew_repeater_rallies set total_atk = total_atk + v_atk where id = p_rally_id;

  return jsonb_build_object('ok', true, 'added_atk', v_atk);
end $$;
