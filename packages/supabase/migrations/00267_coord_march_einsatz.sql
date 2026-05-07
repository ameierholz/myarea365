-- ════════════════════════════════════════════════════════════════════
-- COORD-MARCH (EINSETZEN AUF KARTEN-PUNKT)
-- ════════════════════════════════════════════════════════════════════
-- Erweitert das Marsch-System: Spieler kann Begleiter+Truppen auf einen
-- frei gewählten Karten-Punkt schicken (kein Defender). Marsch endet
-- nach Distanz-basierter Zeit, Truppen kehren automatisch zurück.
--
-- Frontend: EINSETZEN-Button in Heimat-Tap-Modal → Choice (1/Multi) →
-- Single/Multi-Einsatz-Modal → coord_march RPC.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) player_base_attacks: defender optional ──────────────────────
alter table public.player_base_attacks
  alter column defender_user_id drop not null;

alter table public.player_base_attacks
  add column if not exists march_type text not null default 'attack'
  check (march_type in ('attack','coord_march'));

create index if not exists ix_pba_coord_active
  on public.player_base_attacks (ends_at)
  where resolved_at is null and march_type = 'coord_march';

-- outcome erweitern: coord_arrived (kein Combat)
alter table public.player_base_attacks
  drop constraint if exists player_base_attacks_outcome_check;
alter table public.player_base_attacks
  add constraint player_base_attacks_outcome_check
  check (outcome is null or outcome in ('attacker_won','defender_won','draw','attacker_pillaged','coord_arrived'));

-- ─── 2) start_coord_march RPC ───────────────────────────────────────
create or replace function public.start_coord_march(
  p_target_lat double precision,
  p_target_lng double precision,
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
  v_base record;
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
  if p_target_lat is null or p_target_lng is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;

  select * into v_base from public.bases where owner_user_id = v_user;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;

  -- March-Queue-Cap prüfen (zählt alle aktiven Märsche, attack + coord_march)
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

  if v_total_troops < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_troops');
  end if;
  if v_total_troops > v_caps.march_capacity then
    return jsonb_build_object('ok', false, 'error', 'over_capacity',
      'total', v_total_troops, 'cap', v_caps.march_capacity);
  end if;

  -- Distanz + Marsch-Zeit (Begleiter-Bonus)
  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_target_lat - v_base.lat) / 2)), 2) +
    cos(radians(v_base.lat)) * cos(radians(p_target_lat)) *
    power(sin(radians((p_target_lng - v_base.lng) / 2)), 2)
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
    original_target_lat, original_target_lng,
    march_type
  ) values (
    v_user, null,
    v_base.lat, v_base.lng,
    p_target_lat, p_target_lng,
    p_troops, now() + (v_march_seconds || ' seconds')::interval,
    p_guardian_id, p_legion_label,
    p_target_lat, p_target_lng,
    'coord_march'
  ) returning id into v_attack_id;

  return jsonb_build_object(
    'ok', true,
    'march_id', v_attack_id,
    'march_seconds', v_march_seconds,
    'distance_m', round(v_distance_m)::int,
    'ends_at', now() + (v_march_seconds || ' seconds')::interval,
    'queue', jsonb_build_object('active', v_active_count + 1, 'cap', v_caps.march_queue)
  );
end $$;
revoke all on function public.start_coord_march(double precision, double precision, jsonb, uuid, text) from public;
grant execute on function public.start_coord_march(double precision, double precision, jsonb, uuid, text) to authenticated;

-- ─── 3) tick_coord_marches: Auto-Resolve abgelaufener Coord-Märsche ──
-- Truppen kehren komplett zurück (kein Combat). Wird vom Frontend bei
-- jedem /api/base/marches Poll opportunistisch aufgerufen.
create or replace function public.tick_coord_marches()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m record;
  k text; v_cnt int;
  v_count int := 0;
begin
  for m in
    select id, attacker_user_id, troops_committed
      from public.player_base_attacks
     where march_type = 'coord_march'
       and resolved_at is null
       and ends_at <= now()
     for update skip locked
  loop
    -- Truppen zurück
    for k, v_cnt in select * from jsonb_each_text(m.troops_committed) loop
      if v_cnt::int <= 0 then continue; end if;
      insert into public.user_troops (user_id, troop_id, count)
      values (m.attacker_user_id, k, v_cnt::int)
      on conflict (user_id, troop_id) do update
        set count = public.user_troops.count + v_cnt::int;
    end loop;

    update public.player_base_attacks
       set resolved_at = now(),
           outcome = 'coord_arrived'
     where id = m.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
revoke all on function public.tick_coord_marches() from public;
grant execute on function public.tick_coord_marches() to authenticated;

-- ─── 4) get_heimat_active_marches: coord_march einbeziehen ───────────
-- Coord-Märsche tauchen genauso auf wie Attack-Märsche, nur mit kind='coord_march'
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
    case when pba.march_type = 'coord_march' then 'coord_march' else 'attack' end as kind,
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
      or (cm.crew_id is not null and cm.crew_id in (select crew_id from my_crew)) -- Crew sieht eigene
    );
$$;
revoke all on function public.get_heimat_active_marches() from public;
grant execute on function public.get_heimat_active_marches() to authenticated;

comment on function public.start_coord_march(double precision, double precision, jsonb, uuid, text) is
  'Heimat-Karte EINSETZEN: schickt Begleiter+Truppen auf gewählten Karten-Punkt ohne Defender. Truppen kehren nach Ankunft via tick_coord_marches() automatisch zurück.';
