-- ════════════════════════════════════════════════════════════════════
-- HEIMAT-KARTE: CoD-UX RPCs
-- ════════════════════════════════════════════════════════════════════
-- 1) relocate_base_v2          — Cooldown + Krypto-Kosten + Distanz-Limit
-- 2) start_attack_legion       — Multi-Aufgebot kompatibel (bis march_queue)
-- 3) redirect_march            — Drag-Redirect mit 20% Zeit-Strafe
-- 4) hide_in_building          — Truppen verstecken (Garrison)
-- 5) unhide_from_building      — Truppen aus Garrison zurückholen
-- 6) get_heimat_incoming       — Eingehende Märsche im Viewport
-- 7) get_heimat_active_marches — Eigene + Crew-Märsche für Map-Render
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) relocate_base_v2 ──────────────────────────────────────────────
-- Cooldown 24h, max 5 km Radius, Kosten 50 Krypto (gold).
-- Token-Modell entfällt — wir nutzen Krypto + Cooldown.
create or replace function public.relocate_base_v2(
  p_lat double precision,
  p_lng double precision
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_base record;
  v_distance_m numeric;
  v_cooldown_seconds int := 24 * 3600;
  v_cost_gold int := 50;
  v_max_distance_m numeric := 5000;
  v_user_gold int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_position');
  end if;

  select * into v_base from public.bases where owner_user_id = v_user;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;

  -- Cooldown
  if v_base.last_relocate_at is not null
     and v_base.last_relocate_at + (v_cooldown_seconds || ' seconds')::interval > now() then
    return jsonb_build_object(
      'ok', false, 'error', 'on_cooldown',
      'next_at', v_base.last_relocate_at + (v_cooldown_seconds || ' seconds')::interval
    );
  end if;

  -- Distanz
  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_lat - v_base.lat) / 2)), 2) +
    cos(radians(v_base.lat)) * cos(radians(p_lat)) *
    power(sin(radians((p_lng - v_base.lng) / 2)), 2)
  ));
  if v_distance_m > v_max_distance_m then
    return jsonb_build_object('ok', false, 'error', 'too_far',
      'distance_m', round(v_distance_m)::int, 'max_m', v_max_distance_m::int);
  end if;

  -- Krypto prüfen
  select gold into v_user_gold from public.user_resources where user_id = v_user;
  if coalesce(v_user_gold, 0) < v_cost_gold then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gold',
      'need', v_cost_gold, 'have', coalesce(v_user_gold, 0));
  end if;

  -- Aktiv laufender eigener Marsch? Dann nicht verlegen
  if exists (
    select 1 from public.player_base_attacks
     where attacker_user_id = v_user and resolved_at is null and ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'error', 'march_active');
  end if;

  -- History
  insert into public.base_relocate_history (
    user_id, from_lat, from_lng, to_lat, to_lng, distance_m, cost_paid
  ) values (
    v_user, v_base.lat, v_base.lng, p_lat, p_lng, round(v_distance_m)::int,
    jsonb_build_object('gold', v_cost_gold)
  );

  -- Update
  update public.bases
     set lat = p_lat, lng = p_lng,
         last_relocate_at = now(),
         relocate_count = relocate_count + 1,
         updated_at = now()
   where id = v_base.id;

  update public.user_resources
     set gold = gold - v_cost_gold
   where user_id = v_user;

  return jsonb_build_object(
    'ok', true,
    'distance_m', round(v_distance_m)::int,
    'cost_gold', v_cost_gold,
    'next_relocate_at', now() + (v_cooldown_seconds || ' seconds')::interval
  );
end $$;
revoke all on function public.relocate_base_v2(double precision, double precision) from public;
grant execute on function public.relocate_base_v2(double precision, double precision) to authenticated;

-- ─── 2) start_attack_legion ───────────────────────────────────────────
-- Wie attack_player_base, aber respektiert march_queue (mehrere Legionen
-- parallel) statt strikt 1 Angriff. Trägt guardian_id + legion_label.
create or replace function public.start_attack_legion(
  p_defender_user_id uuid,
  p_troops jsonb,
  p_guardian_id uuid default null,
  p_legion_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attacker_base record;
  v_defender_base record;
  v_distance_m numeric;
  v_march_seconds int;
  v_total_troops int := 0;
  v_avail int;
  v_attack_id uuid;
  v_caps record;
  v_active_count int;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_attack_self'); end if;

  select * into v_attacker_base from public.bases where owner_user_id = v_user;
  if v_attacker_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;

  select * into v_defender_base from public.bases where owner_user_id = p_defender_user_id;
  if v_defender_base is null then return jsonb_build_object('ok', false, 'error', 'defender_no_base'); end if;

  if v_defender_base.shield_until is not null and v_defender_base.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'defender_shielded');
  end if;

  -- March-Queue-Cap prüfen
  select * into v_caps from public.get_march_caps(v_user);
  if v_caps is null then v_caps := row(60, 1, 1, 0)::record; end if;

  select count(*)::int into v_active_count
    from public.player_base_attacks
   where attacker_user_id = v_user and resolved_at is null and ends_at > now();

  if v_active_count >= v_caps.march_queue then
    return jsonb_build_object('ok', false, 'error', 'march_queue_full',
      'active', v_active_count, 'cap', v_caps.march_queue);
  end if;

  -- Truppen-Validierung + Cap
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    select count into v_avail from public.user_troops where user_id = v_user and troop_id = k;
    if v_avail is null or v_avail < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops',
        'troop_id', k, 'have', coalesce(v_avail, 0), 'need', v_cnt::int);
    end if;
    v_total_troops := v_total_troops + v_cnt::int;
  end loop;

  if v_total_troops < 10 then
    return jsonb_build_object('ok', false, 'error', 'min_troops_10');
  end if;
  if v_total_troops > v_caps.march_capacity then
    return jsonb_build_object('ok', false, 'error', 'over_capacity',
      'total', v_total_troops, 'cap', v_caps.march_capacity);
  end if;

  -- Distanz + Marsch-Zeit (Wächter-Bonus)
  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((v_defender_base.lat - v_attacker_base.lat) / 2)), 2) +
    cos(radians(v_attacker_base.lat)) * cos(radians(v_defender_base.lat)) *
    power(sin(radians((v_defender_base.lng - v_attacker_base.lng) / 2)), 2)
  ));
  v_march_seconds := greatest(60, least(1800, ceil(v_distance_m / 50)::int));
  if v_caps.guardian_bonus_pct > 0 then
    v_march_seconds := greatest(60, ceil(v_march_seconds * (100 - v_caps.guardian_bonus_pct) / 100.0)::int);
  end if;

  -- Truppen abziehen
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_cnt::int
      where user_id = v_user and troop_id = k;
  end loop;

  insert into public.player_base_attacks (
    attacker_user_id, defender_user_id,
    attacker_lat, attacker_lng, defender_lat, defender_lng,
    troops_committed, ends_at,
    guardian_id, legion_label,
    original_target_lat, original_target_lng, original_defender_id
  ) values (
    v_user, p_defender_user_id,
    v_attacker_base.lat, v_attacker_base.lng,
    v_defender_base.lat, v_defender_base.lng,
    p_troops, now() + (v_march_seconds || ' seconds')::interval,
    p_guardian_id, p_legion_label,
    v_defender_base.lat, v_defender_base.lng, p_defender_user_id
  ) returning id into v_attack_id;

  return jsonb_build_object(
    'ok', true,
    'attack_id', v_attack_id,
    'march_seconds', v_march_seconds,
    'distance_m', round(v_distance_m)::int,
    'ends_at', now() + (v_march_seconds || ' seconds')::interval,
    'queue', jsonb_build_object('active', v_active_count + 1, 'cap', v_caps.march_queue)
  );
end $$;
revoke all on function public.start_attack_legion(uuid, jsonb, uuid, text) from public;
grant execute on function public.start_attack_legion(uuid, jsonb, uuid, text) to authenticated;

-- ─── 3) redirect_march ────────────────────────────────────────────────
-- Während ein Marsch läuft: Ziel umlenken. Neues Ziel kann anderer Spieler
-- oder freier Punkt (kein Spieler dort) sein. +20 % Zeit-Strafe.
create or replace function public.redirect_march(
  p_attack_id uuid,
  p_new_target_lat double precision,
  p_new_target_lng double precision,
  p_new_defender_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  a record;
  v_now timestamptz := now();
  v_remaining_s numeric;
  v_new_distance_m numeric;
  v_new_seconds int;
  v_friction_pct numeric := 1.20;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into a from public.player_base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.attacker_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at <= v_now then return jsonb_build_object('ok', false, 'error', 'already_arrived'); end if;
  if a.redirect_count >= 3 then return jsonb_build_object('ok', false, 'error', 'redirect_cap'); end if;

  -- Distanz von aktueller Position (interpoliert) zum neuen Ziel
  -- Vereinfachung: vom Ursprung neu rechnen, +20% Strafe
  v_new_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_new_target_lat - a.attacker_lat) / 2)), 2) +
    cos(radians(a.attacker_lat)) * cos(radians(p_new_target_lat)) *
    power(sin(radians((p_new_target_lng - a.attacker_lng) / 2)), 2)
  ));
  v_new_seconds := greatest(60, least(1800, ceil(v_new_distance_m / 50 * v_friction_pct)::int));

  insert into public.march_redirects (
    attack_id, user_id, from_target_lat, from_target_lng,
    to_target_lat, to_target_lng, new_ends_at, friction_seconds
  ) values (
    a.id, v_user, a.defender_lat, a.defender_lng,
    p_new_target_lat, p_new_target_lng,
    v_now + (v_new_seconds || ' seconds')::interval,
    v_new_seconds - greatest(60, least(1800, ceil(v_new_distance_m / 50)::int))
  );

  update public.player_base_attacks
     set defender_lat = p_new_target_lat,
         defender_lng = p_new_target_lng,
         defender_user_id = coalesce(p_new_defender_user_id, defender_user_id),
         starts_at = v_now,
         ends_at = v_now + (v_new_seconds || ' seconds')::interval,
         redirect_count = redirect_count + 1
   where id = a.id;

  return jsonb_build_object(
    'ok', true,
    'new_distance_m', round(v_new_distance_m)::int,
    'new_seconds', v_new_seconds,
    'redirects_used', a.redirect_count + 1
  );
end $$;
revoke all on function public.redirect_march(uuid, double precision, double precision, uuid) from public;
grant execute on function public.redirect_march(uuid, double precision, double precision, uuid) to authenticated;

-- ─── 4) hide_in_building ──────────────────────────────────────────────
create or replace function public.hide_in_building(
  p_target_kind text,
  p_target_lat double precision,
  p_target_lng double precision,
  p_troops jsonb,
  p_target_id uuid default null,
  p_guardian_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_avail int;
  v_total int := 0;
  v_garrison_id uuid;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_target_kind not in ('base','crew_repeater','wegelager','mega_repeater') then
    return jsonb_build_object('ok', false, 'error', 'invalid_target_kind');
  end if;

  -- 1 Garrison pro Gebäude pro User
  if exists (
    select 1 from public.base_garrisons
     where user_id = v_user and target_kind = p_target_kind
       and ((p_target_id is not null and target_id = p_target_id)
            or (p_target_id is null and abs(target_lat - p_target_lat) < 0.0001
                and abs(target_lng - p_target_lng) < 0.0001))
       and released_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_garrisoned');
  end if;

  -- Truppen-Verfügbarkeit
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    select count into v_avail from public.user_troops where user_id = v_user and troop_id = k;
    if v_avail is null or v_avail < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops',
        'troop_id', k, 'have', coalesce(v_avail, 0), 'need', v_cnt::int);
    end if;
    v_total := v_total + v_cnt::int;
  end loop;

  if v_total < 1 then return jsonb_build_object('ok', false, 'error', 'no_troops'); end if;

  -- Truppen reservieren
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_cnt::int
      where user_id = v_user and troop_id = k;
  end loop;

  insert into public.base_garrisons (
    user_id, target_kind, target_id, target_lat, target_lng,
    troops, guardian_id
  ) values (
    v_user, p_target_kind, p_target_id, p_target_lat, p_target_lng,
    p_troops, p_guardian_id
  ) returning id into v_garrison_id;

  return jsonb_build_object('ok', true, 'garrison_id', v_garrison_id, 'total_troops', v_total);
end $$;
revoke all on function public.hide_in_building(text, double precision, double precision, jsonb, uuid, uuid) from public;
grant execute on function public.hide_in_building(text, double precision, double precision, jsonb, uuid, uuid) to authenticated;

-- ─── 5) unhide_from_building ──────────────────────────────────────────
create or replace function public.unhide_from_building(p_garrison_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  g record;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into g from public.base_garrisons where id = p_garrison_id for update;
  if g is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if g.user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  if g.released_at is not null then return jsonb_build_object('ok', false, 'error', 'already_released'); end if;

  -- Truppen zurück
  for k, v_cnt in select * from jsonb_each_text(g.troops) loop
    if v_cnt::int <= 0 then continue; end if;
    insert into public.user_troops (user_id, troop_id, count)
    values (v_user, k, v_cnt::int)
    on conflict (user_id, troop_id) do update set count = public.user_troops.count + v_cnt::int;
  end loop;

  update public.base_garrisons
     set released_at = now(),
         released_reason = 'manual_unhide'
   where id = g.id;

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.unhide_from_building(uuid) from public;
grant execute on function public.unhide_from_building(uuid) to authenticated;

-- ─── 6) get_heimat_incoming ───────────────────────────────────────────
-- Eingehende Märsche auf den eigenen User (alle Quellen).
-- Optional Viewport-Filter über bbox-Parameter.
create or replace function public.get_heimat_incoming()
returns table (
  kind text,
  id text,
  attacker_user_id uuid,
  origin_lat double precision,
  origin_lng double precision,
  target_lat double precision,
  target_lng double precision,
  starts_at timestamptz,
  ends_at timestamptz,
  is_friendly boolean,
  attacker_username text,
  attacker_crew_tag text,
  attacker_crew_id uuid,
  troop_count int,
  guardian_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid),
       my_crew as (select crew_id from public.crew_members where user_id = (select uid from me)),
       att as (
         select
           'attack'::text as kind,
           pba.id::text as id,
           pba.attacker_user_id,
           pba.attacker_lat as origin_lat, pba.attacker_lng as origin_lng,
           pba.defender_lat as target_lat, pba.defender_lng as target_lng,
           pba.starts_at, pba.ends_at,
           false as is_friendly,
           u.display_name as attacker_username,
           c.tag as attacker_crew_tag,
           cm.crew_id as attacker_crew_id,
           coalesce((
             select sum((value)::int) from jsonb_each_text(pba.troops_committed)
           ), 0)::int as troop_count,
           pba.guardian_id
         from public.player_base_attacks pba
         join public.users u on u.id = pba.attacker_user_id
         left join public.crew_members cm on cm.user_id = pba.attacker_user_id
         left join public.crews c on c.id = cm.crew_id
         where pba.defender_user_id = (select uid from me)
           and pba.resolved_at is null
           and pba.ends_at > now()
       ),
       rallies as (
         select
           'rally'::text as kind,
           pbr.id::text as id,
           pbr.leader_user_id as attacker_user_id,
           coalesce(b.lat, pbr.defender_lat) as origin_lat,
           coalesce(b.lng, pbr.defender_lng) as origin_lng,
           pbr.defender_lat as target_lat, pbr.defender_lng as target_lng,
           pbr.created_at as starts_at, pbr.march_ends_at as ends_at,
           false as is_friendly,
           u.display_name as attacker_username,
           c.tag as attacker_crew_tag,
           pbr.crew_id as attacker_crew_id,
           coalesce(pbr.total_atk, 0)::int as troop_count,
           null::uuid as guardian_id
         from public.player_base_rallies pbr
         join public.users u on u.id = pbr.leader_user_id
         left join public.crews c on c.id = pbr.crew_id
         left join public.bases b on b.owner_user_id = pbr.leader_user_id
         where pbr.defender_user_id = (select uid from me)
           and pbr.outcome is null
           and pbr.march_ends_at is not null and pbr.march_ends_at > now()
       )
  select * from att
  union all select * from rallies;
$$;
revoke all on function public.get_heimat_incoming() from public;
grant execute on function public.get_heimat_incoming() to authenticated;

-- ─── 7) get_heimat_active_marches ─────────────────────────────────────
-- Eigene aktive Angriffs-Märsche + Crew-Märsche (für Sprite-Render).
create or replace function public.get_heimat_active_marches()
returns table (
  kind text,
  id text,
  is_own boolean,
  is_crew boolean,
  attacker_user_id uuid,
  attacker_username text,
  attacker_crew_tag text,
  origin_lat double precision,
  origin_lng double precision,
  target_lat double precision,
  target_lng double precision,
  starts_at timestamptz,
  ends_at timestamptz,
  troop_count int,
  guardian_id uuid,
  legion_label text,
  redirect_count int
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid),
       my_crew as (select crew_id from public.crew_members where user_id = (select uid from me))
  select
    'attack'::text as kind,
    pba.id::text as id,
    (pba.attacker_user_id = (select uid from me)) as is_own,
    (cm.crew_id is not null and cm.crew_id in (select crew_id from my_crew)) as is_crew,
    pba.attacker_user_id,
    u.display_name as attacker_username,
    c.tag as attacker_crew_tag,
    pba.attacker_lat as origin_lat, pba.attacker_lng as origin_lng,
    pba.defender_lat as target_lat, pba.defender_lng as target_lng,
    pba.starts_at, pba.ends_at,
    coalesce((select sum((value)::int) from jsonb_each_text(pba.troops_committed)), 0)::int as troop_count,
    pba.guardian_id,
    pba.legion_label,
    pba.redirect_count
  from public.player_base_attacks pba
  join public.users u on u.id = pba.attacker_user_id
  left join public.crew_members cm on cm.user_id = pba.attacker_user_id
  left join public.crews c on c.id = cm.crew_id
  where pba.resolved_at is null
    and pba.ends_at > now()
    and (
      pba.attacker_user_id = (select uid from me)
      or pba.defender_user_id = (select uid from me)
      or (cm.crew_id is not null and cm.crew_id in (select crew_id from my_crew))
    );
$$;
revoke all on function public.get_heimat_active_marches() from public;
grant execute on function public.get_heimat_active_marches() to authenticated;
