-- ════════════════════════════════════════════════════════════════════
-- CREW TURF — Funkmasten/Repeater + Crew-Gebiete + Angriff/Rally
-- ════════════════════════════════════════════════════════════════════
-- Crews beanspruchen reale Straßenzüge durch das Setzen von Repeatern.
-- Erster Repeater = HQ (Zentral-Server, frei platzierbar).
-- Folgende Repeater müssen in CHAIN_RADIUS_M eines eigenen Repeaters
-- liegen (Chain-Rule). Pro Repeater entsteht ein TURF_RADIUS_M Buffer,
-- die Vereinigung dieser Buffer ist das Crew-Gebiet (Turf).
-- Gegnerische Repeater können angegriffen werden — Solo oder per Rally.
-- HP=0 → Repeater zerstört → Turf schrumpft automatisch.
-- ════════════════════════════════════════════════════════════════════

-- ─── 0) Tabelle: crew_repeaters ──────────────────────────────────────
create table if not exists public.crew_repeaters (
  id              uuid primary key default gen_random_uuid(),
  crew_id         uuid not null references public.crews(id) on delete cascade,
  founder_user_id uuid not null references public.users(id) on delete set null,
  kind            text not null check (kind in ('hq','repeater','mega')),
  tier            int  not null default 1 check (tier between 1 and 3),
  label           text,
  lat             double precision not null,
  lng             double precision not null,
  hp              int  not null,
  max_hp          int  not null,
  shield_until    timestamptz,                 -- temporäre Immunität nach Bau
  destroyed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_crew_repeaters_crew     on public.crew_repeaters(crew_id) where destroyed_at is null;
create index if not exists idx_crew_repeaters_bbox_lat on public.crew_repeaters(lat) where destroyed_at is null;
create index if not exists idx_crew_repeaters_bbox_lng on public.crew_repeaters(lng) where destroyed_at is null;
create index if not exists idx_crew_repeaters_kind     on public.crew_repeaters(kind, destroyed_at);

alter table public.crew_repeaters enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_repeaters' and policyname='crew_repeaters_read_all') then
    create policy crew_repeaters_read_all on public.crew_repeaters for select using (true);
  end if;
end $$;

-- ─── 1) Tabelle: crew_repeater_attacks (Solo) ────────────────────────
create table if not exists public.crew_repeater_attacks (
  id                uuid primary key default gen_random_uuid(),
  attacker_user_id  uuid not null references public.users(id) on delete cascade,
  attacker_crew_id  uuid references public.crews(id) on delete set null,
  repeater_id       uuid not null references public.crew_repeaters(id) on delete cascade,
  troops_sent       jsonb not null,
  total_atk         bigint not null,
  arrival_at        timestamptz not null,
  status            text not null default 'marching' check (status in ('marching','done','aborted')),
  outcome           text check (outcome in ('attacker_won','defender_won','draw','aborted')),
  hp_before         int,
  hp_after          int,
  hp_damage         int,
  losses_attacker   jsonb,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_cra_pending on public.crew_repeater_attacks(arrival_at) where status='marching';
create index if not exists idx_cra_repeater on public.crew_repeater_attacks(repeater_id, status);

alter table public.crew_repeater_attacks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_repeater_attacks' and policyname='cra_read_relevant') then
    create policy cra_read_relevant on public.crew_repeater_attacks for select using (
      attacker_user_id = auth.uid() or exists (
        select 1 from public.crew_repeaters r
         where r.id = crew_repeater_attacks.repeater_id
           and r.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
      )
    );
  end if;
end $$;

-- ─── 2) Tabelle: crew_repeater_rallies ──────────────────────────────
create table if not exists public.crew_repeater_rallies (
  id                uuid primary key default gen_random_uuid(),
  leader_user_id    uuid not null references public.users(id) on delete cascade,
  attacker_crew_id  uuid not null references public.crews(id) on delete cascade,
  repeater_id       uuid not null references public.crew_repeaters(id) on delete cascade,
  prep_seconds      int  not null check (prep_seconds in (180, 480, 1680)),
  prep_ends_at      timestamptz not null,
  march_ends_at     timestamptz,
  status            text not null default 'preparing'
                    check (status in ('preparing','marching','fighting','done','aborted')),
  outcome           text check (outcome in ('attacker_won','defender_won','draw','aborted')),
  total_atk         bigint default 0,
  hp_before         int,
  hp_after          int,
  hp_damage         int,
  losses_attacker   jsonb,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists idx_crr_crew on public.crew_repeater_rallies(attacker_crew_id, status);
create index if not exists idx_crr_open on public.crew_repeater_rallies(prep_ends_at) where status='preparing';
create index if not exists idx_crr_marching on public.crew_repeater_rallies(march_ends_at) where status='marching';

alter table public.crew_repeater_rallies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_repeater_rallies' and policyname='crr_read_member_or_target') then
    create policy crr_read_member_or_target on public.crew_repeater_rallies for select using (
      attacker_crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
      or exists (
        select 1 from public.crew_repeaters r
         where r.id = crew_repeater_rallies.repeater_id
           and r.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
      )
    );
  end if;
end $$;

create table if not exists public.crew_repeater_rally_participants (
  rally_id     uuid not null references public.crew_repeater_rallies(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  troops_sent  jsonb not null,
  troop_atk    bigint not null,
  joined_at    timestamptz not null default now(),
  primary key (rally_id, user_id)
);
alter table public.crew_repeater_rally_participants enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_repeater_rally_participants' and policyname='crrp_read_relevant') then
    create policy crrp_read_relevant on public.crew_repeater_rally_participants for select using (
      user_id = auth.uid() or exists (
        select 1 from public.crew_repeater_rallies r
         where r.id = crew_repeater_rally_participants.rally_id
           and r.attacker_crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
      )
    );
  end if;
end $$;

-- ─── 3) Konstanten + Helper ──────────────────────────────────────────
create or replace function public._repeater_chain_radius_m() returns int language sql immutable as $$ select 400 $$;
create or replace function public._repeater_turf_radius_m()  returns int language sql immutable as $$ select 200 $$;

create or replace function public._repeater_kind_stats(p_kind text)
returns table(max_hp int, cost_gold int, cost_wood int, cost_stone int, build_shield_s int)
language sql immutable as $$
  select t.max_hp, t.cost_gold, t.cost_wood, t.cost_stone, t.build_shield_s
    from (values
      ('hq',       10000, 5000, 2000, 2000, 1800),
      ('repeater',  3000,  500,  500,  500,  600),
      ('mega',      8000, 2000, 1000, 1500, 1200)
    ) as t(kind, max_hp, cost_gold, cost_wood, cost_stone, build_shield_s)
   where t.kind = p_kind;
$$;

-- Haversine in Metern (für Chain-Rule ohne PostGIS-Anforderung)
create or replace function public._haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians((lat2-lat1)/2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2-lng1)/2)), 2)
  ));
$$;

-- ─── 4) RPC: place_crew_repeater ────────────────────────────────────
create or replace function public.place_crew_repeater(
  p_lat double precision,
  p_lng double precision,
  p_kind text default 'repeater',
  p_label text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing_count int;
  v_in_chain boolean;
  v_stats record;
  v_repeater_id uuid;
  v_res record;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_kind not in ('hq','repeater','mega') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select * into v_stats from public._repeater_kind_stats(p_kind);

  -- HQ-Logik: erste Crew-Repeater MUSS hq sein, danach NUR EIN hq pro Crew erlaubt
  select count(*) into v_existing_count
    from public.crew_repeaters
   where crew_id = v_crew and destroyed_at is null;

  if v_existing_count = 0 and p_kind <> 'hq' then
    return jsonb_build_object('ok', false, 'error', 'first_must_be_hq');
  end if;
  if p_kind = 'hq' and v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'hq_already_exists');
  end if;

  -- Chain-Rule (ausser für HQ): Innerhalb von chain_radius eines eigenen lebenden Repeaters
  if p_kind <> 'hq' then
    select exists (
      select 1 from public.crew_repeaters
       where crew_id = v_crew
         and destroyed_at is null
         and public._haversine_m(lat, lng, p_lat, p_lng) <= public._repeater_chain_radius_m()
    ) into v_in_chain;
    if not v_in_chain then
      return jsonb_build_object('ok', false, 'error', 'out_of_chain');
    end if;
  end if;

  -- Mindestabstand zu fremden Repeatern (50 m), damit kein Kleben am Gegner
  if exists (
    select 1 from public.crew_repeaters
     where crew_id <> v_crew
       and destroyed_at is null
       and public._haversine_m(lat, lng, p_lat, p_lng) <= 50
  ) then
    return jsonb_build_object('ok', false, 'error', 'too_close_to_enemy');
  end if;

  -- Resourcen-Check + Abzug
  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res
    from public.user_resources
   where user_id = v_user;

  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood or v_res.stone < v_stats.cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood, 'stone', v_stats.cost_stone));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone
   where user_id = v_user;

  insert into public.crew_repeaters (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, shield_until
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, initcap(p_kind)), p_lat, p_lng,
    v_stats.max_hp, v_stats.max_hp,
    now() + (v_stats.build_shield_s || ' seconds')::interval
  )
  returning id into v_repeater_id;

  return jsonb_build_object('ok', true, 'repeater_id', v_repeater_id, 'kind', p_kind, 'hp', v_stats.max_hp);
end $$;

grant execute on function public.place_crew_repeater(double precision, double precision, text, text) to authenticated;

-- ─── 5) RPC: get_crew_repeaters_in_bbox ─────────────────────────────
create or replace function public.get_crew_repeaters_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  id uuid, crew_id uuid, crew_name text, crew_tag text,
  kind text, tier int, label text, lat double precision, lng double precision,
  hp int, max_hp int, shield_until timestamptz, is_own boolean
) language sql security definer as $$
  select r.id, r.crew_id, c.name as crew_name,
         upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)) as crew_tag,
         r.kind, r.tier, r.label, r.lat, r.lng, r.hp, r.max_hp, r.shield_until,
         r.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own
    from public.crew_repeaters r
    join public.crews c on c.id = r.crew_id
   where r.destroyed_at is null
     and r.lat between p_min_lat and p_max_lat
     and r.lng between p_min_lng and p_max_lng;
$$;
grant execute on function public.get_crew_repeaters_in_bbox(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 6) RPC: get_crew_turf_polygons (GeoJSON pro Crew) ──────────────
-- Aggregiert lebende Repeater zu PostGIS-Buffern, Union pro Crew → GeoJSON
create or replace function public.get_crew_turf_polygons(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(crew_id uuid, crew_name text, crew_tag text, is_own boolean, geojson jsonb)
language plpgsql security definer as $$
declare
  v_radius int := public._repeater_turf_radius_m();
begin
  return query
    with rep as (
      select r.crew_id, r.lat, r.lng,
             ST_Buffer(
               ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
               v_radius
             ) as buf
        from public.crew_repeaters r
       where r.destroyed_at is null
         and r.lat between p_min_lat - 0.01 and p_max_lat + 0.01
         and r.lng between p_min_lng - 0.02 and p_max_lng + 0.02
    ),
    agg as (
      select crew_id, ST_Transform(ST_Union(buf), 4326) as poly
        from rep
       group by crew_id
    )
    select a.crew_id,
           c.name,
           upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)) as crew_tag,
           a.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own,
           ST_AsGeoJSON(a.poly)::jsonb
      from agg a
      join public.crews c on c.id = a.crew_id;
end $$;
grant execute on function public.get_crew_turf_polygons(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 7) RPC: attack_crew_repeater (Solo) ────────────────────────────
create or replace function public.attack_crew_repeater(
  p_repeater_id uuid,
  p_troops jsonb       -- {"infantry": 200, "cavalry": 50, ...}  (troop_id → count)
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid;
  v_repeater record;
  v_atk bigint := 0;
  v_arrival timestamptz;
  v_attack_id uuid;
  k text;
  v int;
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

  -- Truppen-Verfügbarkeit + Abzug + ATK-Berechnung
  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (
      select 1 from public.user_troops
       where user_id = v_user and troop_id = k and count >= (v::int)
    ) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
    v_atk := v_atk + (v::int) * coalesce((select atk from public.troops_catalog where id = k), 10);
  end loop;

  if v_atk = 0 then return jsonb_build_object('ok', false, 'error', 'no_troops_sent'); end if;

  v_arrival := now() + interval '60 seconds';

  insert into public.crew_repeater_attacks (
    attacker_user_id, attacker_crew_id, repeater_id, troops_sent, total_atk, arrival_at
  ) values (
    v_user, v_my_crew, p_repeater_id, p_troops, v_atk, v_arrival
  ) returning id into v_attack_id;

  return jsonb_build_object('ok', true, 'attack_id', v_attack_id, 'arrival_at', v_arrival, 'total_atk', v_atk);
end $$;
grant execute on function public.attack_crew_repeater(uuid, jsonb) to authenticated;

-- ─── 8) RPC: resolve_due_crew_repeater_attacks (cron) ───────────────
create or replace function public.resolve_due_crew_repeater_attacks()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  a record;
  v_repeater record;
  v_dmg int;
  v_outcome text;
  v_loss_pct numeric;
  v_losses jsonb;
  v_new_hp int;
  k text; v int;
begin
  for a in
    select * from public.crew_repeater_attacks
     where status = 'marching' and arrival_at <= now()
     for update skip locked
  loop
    select id, crew_id, hp, max_hp, kind, label, lat, lng
      into v_repeater
      from public.crew_repeaters
     where id = a.repeater_id and destroyed_at is null
     for update;

    if v_repeater is null then
      update public.crew_repeater_attacks set status='aborted', outcome='aborted', resolved_at=now() where id = a.id;
      continue;
    end if;

    -- Schaden = max(60% ATK, 200)
    v_dmg := greatest(200, (a.total_atk * 0.6)::int);
    v_new_hp := greatest(0, v_repeater.hp - v_dmg);
    v_outcome := case when v_new_hp = 0 then 'attacker_won' else 'defender_won' end;
    v_loss_pct := case when v_outcome='attacker_won' then 0.20 else 0.45 end;

    -- Truppen-Verluste berechnen + zurück an Attacker
    v_losses := '{}'::jsonb;
    for k, v in select * from jsonb_each_text(a.troops_sent) loop
      declare v_lost int := ((v::int) * v_loss_pct)::int;
              v_back int := (v::int) - v_lost;
      begin
        v_losses := v_losses || jsonb_build_object(k, v_lost);
        if v_back > 0 then
          insert into public.user_troops (user_id, troop_id, count)
          values (a.attacker_user_id, k, v_back)
          on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
        end if;
      end;
    end loop;

    -- Repeater-State updaten
    if v_outcome = 'attacker_won' then
      update public.crew_repeaters
         set hp = 0, destroyed_at = now()
       where id = v_repeater.id;
    else
      update public.crew_repeaters set hp = v_new_hp where id = v_repeater.id;
    end if;

    update public.crew_repeater_attacks
       set status='done', outcome=v_outcome, hp_before=v_repeater.hp, hp_after=v_new_hp,
           hp_damage=v_dmg, losses_attacker=v_losses, resolved_at=now()
     where id = a.id;

    -- Inbox: Attacker
    insert into public.user_inbox (user_id, title, body)
    values (a.attacker_user_id,
      case when v_outcome='attacker_won' then '⚔️ Repeater zerstört' else '⚔️ Angriff abgewehrt' end,
      format(
        'Angriff auf Repeater "%s" (%s) bei %.5f, %.5f.\n'||
        'Schaden: %s HP — vorher %s, jetzt %s.\n'||
        'Verluste: %s\n%s',
        coalesce(v_repeater.label, v_repeater.kind), v_repeater.kind, v_repeater.lat, v_repeater.lng,
        v_dmg, v_repeater.hp, v_new_hp,
        v_losses::text,
        case when v_outcome='attacker_won' then '✓ Repeater offline — Crew-Turf schrumpft.' else 'Repeater hält stand — versuch es mit mehr Truppen.' end
      ));

    -- Inbox: alle Defender-Crew-Members
    insert into public.user_inbox (user_id, title, body)
    select cm.user_id,
      case when v_outcome='attacker_won' then '🚨 Repeater verloren' else '🛡️ Repeater verteidigt' end,
      format(
        'Eu Repeater "%s" wurde angegriffen.\nSchaden: %s HP (jetzt %s/%s).\n%s',
        coalesce(v_repeater.label, v_repeater.kind),
        v_dmg, v_new_hp, v_repeater.max_hp,
        case when v_outcome='attacker_won' then '✗ Repeater zerstört — Turf reduziert.' else 'Stellung gehalten.' end
      )
      from public.crew_members cm
     where cm.crew_id = v_repeater.crew_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.resolve_due_crew_repeater_attacks() to authenticated;

-- ─── 9) RPC: start_crew_repeater_rally (Crew-Aufgebot) ──────────────
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
  v_atk bigint := 0;
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

  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (select 1 from public.user_troops where user_id = v_user and troop_id = k and count >= (v::int)) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
    v_atk := v_atk + (v::int) * coalesce((select atk from public.troops_catalog where id = k), 10);
  end loop;
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
grant execute on function public.start_crew_repeater_rally(uuid, int, jsonb) to authenticated;

-- ─── 10) RPC: join_crew_repeater_rally ──────────────────────────────
create or replace function public.join_crew_repeater_rally(
  p_rally_id uuid, p_troops jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  v_atk bigint := 0;
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

  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    if not exists (select 1 from public.user_troops where user_id = v_user and troop_id = k and count >= (v::int)) then
      return jsonb_build_object('ok', false, 'error', 'troops_insufficient', 'troop_id', k);
    end if;
    update public.user_troops set count = count - (v::int) where user_id = v_user and troop_id = k;
    v_atk := v_atk + (v::int) * coalesce((select atk from public.troops_catalog where id = k), 10);
  end loop;
  if v_atk = 0 then return jsonb_build_object('ok', false, 'error', 'no_troops_sent'); end if;

  insert into public.crew_repeater_rally_participants (rally_id, user_id, troops_sent, troop_atk)
  values (p_rally_id, v_user, p_troops, v_atk);
  update public.crew_repeater_rallies set total_atk = total_atk + v_atk where id = p_rally_id;

  return jsonb_build_object('ok', true, 'added_atk', v_atk);
end $$;
grant execute on function public.join_crew_repeater_rally(uuid, jsonb) to authenticated;

-- ─── 11) RPC: resolve_due_crew_repeater_rallies (cron) ──────────────
create or replace function public.resolve_due_crew_repeater_rallies()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r record;
  rep record;
  p record;
  v_dmg int;
  v_new_hp int;
  v_outcome text;
  v_loss_pct numeric;
  v_losses jsonb;
  k text; v int;
begin
  -- Prep-Phase abgelaufen → marching
  update public.crew_repeater_rallies
     set status='marching', march_ends_at = now() + interval '60 seconds'
   where status='preparing' and prep_ends_at <= now();

  for r in
    select * from public.crew_repeater_rallies
     where status='marching' and march_ends_at <= now()
     for update skip locked
  loop
    select id, crew_id, hp, max_hp, kind, label, lat, lng into rep
      from public.crew_repeaters where id = r.repeater_id and destroyed_at is null
      for update;

    if rep is null then
      update public.crew_repeater_rallies set status='aborted', outcome='aborted', resolved_at=now() where id = r.id;
      continue;
    end if;

    v_dmg := greatest(400, (r.total_atk * 0.7)::int);
    v_new_hp := greatest(0, rep.hp - v_dmg);
    v_outcome := case when v_new_hp = 0 then 'attacker_won' else 'defender_won' end;
    v_loss_pct := case when v_outcome='attacker_won' then 0.18 else 0.40 end;

    if v_outcome = 'attacker_won' then
      update public.crew_repeaters set hp = 0, destroyed_at = now() where id = rep.id;
    else
      update public.crew_repeaters set hp = v_new_hp where id = rep.id;
    end if;

    update public.crew_repeater_rallies
       set status='done', outcome=v_outcome, hp_before=rep.hp, hp_after=v_new_hp, hp_damage=v_dmg, resolved_at=now()
     where id = r.id;

    -- pro Teilnehmer Verluste + Survivor zurück + Inbox
    for p in
      select * from public.crew_repeater_rally_participants where rally_id = r.id
    loop
      v_losses := '{}'::jsonb;
      for k, v in select * from jsonb_each_text(p.troops_sent) loop
        declare v_lost int := ((v::int) * v_loss_pct)::int;
                v_back int := (v::int) - v_lost;
        begin
          v_losses := v_losses || jsonb_build_object(k, v_lost);
          if v_back > 0 then
            insert into public.user_troops (user_id, troop_id, count)
            values (p.user_id, k, v_back)
            on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
          end if;
        end;
      end loop;

      insert into public.user_inbox (user_id, title, body) values (
        p.user_id,
        case when v_outcome='attacker_won' then '⚔️ Crew-Angriff erfolgreich' else '⚔️ Crew-Angriff abgewehrt' end,
        format('Aufgebot vs Repeater "%s" — Crew-Schaden %s HP (jetzt %s/%s). Deine Verluste: %s',
               coalesce(rep.label, rep.kind), v_dmg, v_new_hp, rep.max_hp, v_losses::text)
      );
    end loop;

    -- Inbox: Defender-Crew
    insert into public.user_inbox (user_id, title, body)
    select cm.user_id,
      case when v_outcome='attacker_won' then '🚨 Repeater fällt' else '🛡️ Repeater hält' end,
      format('Crew-Aufgebot griff "%s" an. Schaden %s HP. %s',
             coalesce(rep.label, rep.kind), v_dmg,
             case when v_outcome='attacker_won' then '✗ Repeater offline.' else 'Verteidigung erfolgreich.' end)
      from public.crew_members cm where cm.crew_id = rep.crew_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.resolve_due_crew_repeater_rallies() to authenticated;

-- ─── 12) Convenience-RPC: my_crew_repeater_summary ──────────────────
create or replace function public.my_crew_repeater_summary()
returns jsonb language sql security definer as $$
  with my_crew as (
    select crew_id from public.crew_members where user_id = auth.uid() limit 1
  )
  select jsonb_build_object(
    'crew_id', (select crew_id from my_crew),
    'count_alive', (select count(*) from public.crew_repeaters
                     where crew_id = (select crew_id from my_crew) and destroyed_at is null),
    'has_hq', exists (select 1 from public.crew_repeaters
                       where crew_id = (select crew_id from my_crew) and kind='hq' and destroyed_at is null),
    'turf_radius_m', public._repeater_turf_radius_m(),
    'chain_radius_m', public._repeater_chain_radius_m()
  );
$$;
grant execute on function public.my_crew_repeater_summary() to authenticated;
