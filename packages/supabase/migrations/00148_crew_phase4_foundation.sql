-- ════════════════════════════════════════════════════════════════════
-- CREW — Phase 4 Foundation
-- ════════════════════════════════════════════════════════════════════
-- 1) crew_buildings: generische Tabelle für die neuen Bauwerk-Typen
--    (Schwarzmarkt, Bunker, Kiez-Treffpunkt, Tunnel)
--    Belagerungs-Repeater = Upgrade existierender Repeater (is_siege flag)
-- 2) crew_wars: Krieg-Deklaration zwischen Crews
-- 3) Place/destroy RPCs für crew_buildings
-- 4) upgrade_to_siege_repeater RPC (Belagerungs-Upgrade)
-- 5) declare_crew_war / end_crew_war RPCs
--
-- Game-Mechaniken (Schwarzmarkt-Income, Bunker-Defense, etc.) sind
-- bewusst nicht implementiert — Stub damit Placement + Map-Anzeige geht,
-- Mechanik kommt in dedizierten Folge-Migrations je Bauwerk.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) crew_buildings ───────────────────────────────────────────────
create table if not exists public.crew_buildings (
  id              uuid primary key default gen_random_uuid(),
  crew_id         uuid not null references public.crews(id) on delete cascade,
  founder_user_id uuid references public.users(id) on delete set null,
  -- Bauwerk-Typ. Repeater (hq/mega/repeater) bleiben in crew_repeaters.
  kind            text not null check (kind in ('blackmarket', 'bunker', 'hangout', 'tunnel')),
  level           int  not null default 1 check (level between 1 and 5),
  label           text,
  lat             double precision not null,
  lng             double precision not null,
  hp              int  not null,
  max_hp          int  not null,
  -- Kind-spezifische Metadaten als JSONB (Reserves, deployed-guardians, buff-state, endpoints, etc.)
  kind_data       jsonb not null default '{}'::jsonb,
  destroyed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_crew_buildings_crew on public.crew_buildings(crew_id) where destroyed_at is null;
create index if not exists idx_crew_buildings_kind on public.crew_buildings(kind, destroyed_at);
create index if not exists idx_crew_buildings_bbox_lat on public.crew_buildings(lat) where destroyed_at is null;
create index if not exists idx_crew_buildings_bbox_lng on public.crew_buildings(lng) where destroyed_at is null;

alter table public.crew_buildings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_buildings' and policyname='crew_buildings_read_all') then
    create policy crew_buildings_read_all on public.crew_buildings for select using (true);
  end if;
end $$;

-- ─── 2) Per-Kind Stats (Cost + HP + max-Anzahl pro Crew) ─────────────
create or replace function public._crew_building_stats(p_kind text)
returns table(max_hp int, cost_gold int, cost_wood int, cost_stone int, cost_mana int, max_per_crew int)
language sql immutable as $$
  select t.max_hp, t.cost_gold, t.cost_wood, t.cost_stone, t.cost_mana, t.max_per_crew
    from (values
      ('blackmarket', 5000, 3000, 1500, 1500, 0,     1),  -- max 1 Schwarzmarkt
      ('bunker',      4000,  800,  600,  600, 0,     6),  -- wie CoD: max 6 Keeps
      ('hangout',     2500,  200,  300,  300, 0,     3),  -- max 3 Treffpunkte
      ('tunnel',      3000, 1000, 1000, 1000, 500,  10)  -- max 10 (Tunnel sind Endpunkt-Paare aber wir zählen einzeln)
    ) as t(kind, max_hp, cost_gold, cost_wood, cost_stone, cost_mana, max_per_crew)
   where t.kind = p_kind;
$$;

-- ─── 3) place_crew_building RPC ──────────────────────────────────────
create or replace function public.place_crew_building(
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_label text default null,
  p_kind_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_stats record;
  v_existing_count int;
  v_id uuid;
  v_res record;
  v_in_own_turf boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden',
      'hint', 'Nur Leader/Officer/Admin dürfen Bauwerke errichten');
  end if;

  select * into v_stats from public._crew_building_stats(p_kind);
  if v_stats is null then return jsonb_build_object('ok', false, 'error', 'unknown_kind'); end if;

  -- Max-pro-Crew check
  select count(*) into v_existing_count
    from public.crew_buildings
   where crew_id = v_crew and kind = p_kind and destroyed_at is null;
  if v_existing_count >= v_stats.max_per_crew then
    return jsonb_build_object('ok', false, 'error', 'max_reached',
      'limit', v_stats.max_per_crew, 'current', v_existing_count);
  end if;

  -- Bauwerke MÜSSEN im eigenen Crew-Turf platziert werden
  v_in_own_turf := public._user_in_own_crew_turf(v_user, p_lat, p_lng);
  if not v_in_own_turf then
    return jsonb_build_object('ok', false, 'error', 'must_be_in_own_turf',
      'hint', 'Bauwerke nur im eigenen Crew-Gebiet platzierbar');
  end if;

  -- Resource-Check
  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone, coalesce(mana,0) mana
    into v_res from public.user_resources where user_id = v_user;
  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood
     or v_res.stone < v_stats.cost_stone or v_res.mana < v_stats.cost_mana then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood,
                                  'stone', v_stats.cost_stone, 'mana', v_stats.cost_mana));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone,
         mana = mana - v_stats.cost_mana
   where user_id = v_user;

  insert into public.crew_buildings (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, kind_data
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, initcap(p_kind)),
    p_lat, p_lng, v_stats.max_hp, v_stats.max_hp, p_kind_data
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'building_id', v_id, 'kind', p_kind, 'hp', v_stats.max_hp);
end $$;
grant execute on function public.place_crew_building(text, double precision, double precision, text, jsonb) to authenticated;

-- ─── 4) destroy_crew_building RPC ────────────────────────────────────
create or replace function public.destroy_crew_building(p_building_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_b record;
  v_stats record;
  v_refund_gold int;
  v_refund_wood int;
  v_refund_stone int;
  v_refund_mana int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members where user_id = v_user limit 1;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select id, crew_id, kind into v_b
    from public.crew_buildings
   where id = p_building_id and destroyed_at is null
   for update;
  if v_b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_b.crew_id <> v_crew then return jsonb_build_object('ok', false, 'error', 'not_own_crew'); end if;

  -- 50% Refund
  select * into v_stats from public._crew_building_stats(v_b.kind);
  v_refund_gold  := (v_stats.cost_gold  * 0.5)::int;
  v_refund_wood  := (v_stats.cost_wood  * 0.5)::int;
  v_refund_stone := (v_stats.cost_stone * 0.5)::int;
  v_refund_mana  := (v_stats.cost_mana  * 0.5)::int;

  insert into public.user_resources (user_id, gold, wood, stone, mana)
       values (v_user, v_refund_gold, v_refund_wood, v_refund_stone, v_refund_mana)
  on conflict (user_id) do update set
    gold = public.user_resources.gold + excluded.gold,
    wood = public.user_resources.wood + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    mana = public.user_resources.mana + excluded.mana;

  update public.crew_buildings set destroyed_at = now(), hp = 0 where id = p_building_id;

  return jsonb_build_object('ok', true, 'refund',
    jsonb_build_object('gold', v_refund_gold, 'wood', v_refund_wood,
                       'stone', v_refund_stone, 'mana', v_refund_mana));
end $$;
grant execute on function public.destroy_crew_building(uuid) to authenticated;

-- ─── 5) get_crew_buildings_in_bbox RPC ───────────────────────────────
create or replace function public.get_crew_buildings_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  id uuid, crew_id uuid, crew_name text, crew_tag text,
  kind text, level int, label text, lat double precision, lng double precision,
  hp int, max_hp int, kind_data jsonb, is_own boolean, territory_color text
) language sql security definer as $$
  select b.id, b.crew_id, c.name as crew_name,
         upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)) as crew_tag,
         b.kind, b.level, b.label, b.lat, b.lng, b.hp, b.max_hp, b.kind_data,
         b.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own,
         coalesce(c.territory_color, '#22D1C3') as territory_color
    from public.crew_buildings b
    join public.crews c on c.id = b.crew_id
   where b.destroyed_at is null
     and b.lat between p_min_lat and p_max_lat
     and b.lng between p_min_lng and p_max_lng;
$$;
grant execute on function public.get_crew_buildings_in_bbox(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 6) Belagerungs-Upgrade: Repeater → Belagerungs-Repeater ──────────
alter table public.crew_repeaters add column if not exists is_siege boolean not null default false;
alter table public.crew_repeaters add column if not exists siege_upgraded_at timestamptz;

create or replace function public.upgrade_to_siege_repeater(p_repeater_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_rep record;
  v_cost_gold int := 3000;
  v_cost_wood int := 1500;
  v_cost_stone int := 1500;
  v_res record;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members where user_id = v_user limit 1;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select id, crew_id, kind, is_siege into v_rep
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   for update;
  if v_rep is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_rep.crew_id <> v_crew then return jsonb_build_object('ok', false, 'error', 'not_own_crew'); end if;
  if v_rep.kind <> 'repeater' then
    return jsonb_build_object('ok', false, 'error', 'only_standard_repeaters', 'hint', 'Nur Standard-Repeater können upgegradet werden');
  end if;
  if v_rep.is_siege then return jsonb_build_object('ok', false, 'error', 'already_upgraded'); end if;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res from public.user_resources where user_id = v_user;
  if v_res.gold < v_cost_gold or v_res.wood < v_cost_wood or v_res.stone < v_cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_cost_gold, 'wood', v_cost_wood, 'stone', v_cost_stone));
  end if;

  update public.user_resources
     set gold = gold - v_cost_gold, wood = wood - v_cost_wood, stone = stone - v_cost_stone
   where user_id = v_user;

  update public.crew_repeaters
     set is_siege = true, siege_upgraded_at = now()
   where id = p_repeater_id;

  return jsonb_build_object('ok', true, 'repeater_id', p_repeater_id);
end $$;
grant execute on function public.upgrade_to_siege_repeater(uuid) to authenticated;

-- ─── 7) crew_wars: Krieg-Deklaration zwischen Crews ──────────────────
create table if not exists public.crew_wars (
  id              uuid primary key default gen_random_uuid(),
  attacker_crew   uuid not null references public.crews(id) on delete cascade,
  defender_crew   uuid not null references public.crews(id) on delete cascade,
  declared_by     uuid not null references public.users(id) on delete set null,
  declared_at     timestamptz not null default now(),
  ends_at         timestamptz not null,
  status          text not null default 'active' check (status in ('active', 'ended')),
  attacker_score  int  not null default 0,  -- Captures + Repeater-Zerstörungen
  defender_score  int  not null default 0,
  winner_crew     uuid references public.crews(id),
  ended_at        timestamptz,
  unique (attacker_crew, defender_crew, declared_at)
);
create index if not exists idx_crew_wars_active on public.crew_wars(ends_at) where status = 'active';
create index if not exists idx_crew_wars_crew_attacker on public.crew_wars(attacker_crew) where status = 'active';
create index if not exists idx_crew_wars_crew_defender on public.crew_wars(defender_crew) where status = 'active';

alter table public.crew_wars enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_wars' and policyname='crew_wars_read_all') then
    create policy crew_wars_read_all on public.crew_wars for select using (true);
  end if;
end $$;

-- ─── 8) declare_crew_war RPC ─────────────────────────────────────────
create or replace function public.declare_crew_war(p_target_crew_id uuid, p_duration_days int default 7)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid;
  v_role text;
  v_existing_count int;
  v_war_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_duration_days not in (3, 7, 14) then
    return jsonb_build_object('ok', false, 'error', 'invalid_duration', 'hint', '3, 7 oder 14 Tage');
  end if;

  select crew_id, role into v_my_crew, v_role
    from public.crew_members where user_id = v_user limit 1;
  if v_my_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if v_role <> 'leader' then
    return jsonb_build_object('ok', false, 'error', 'leader_only',
      'hint', 'Nur der Crew-Leader darf Krieg erklären');
  end if;
  if v_my_crew = p_target_crew_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_declare_on_self');
  end if;

  -- Check: keine bestehende aktive Kriegsbeziehung
  select count(*) into v_existing_count from public.crew_wars
   where status = 'active'
     and ((attacker_crew = v_my_crew and defender_crew = p_target_crew_id)
       or (attacker_crew = p_target_crew_id and defender_crew = v_my_crew));
  if v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'war_already_active');
  end if;

  insert into public.crew_wars (attacker_crew, defender_crew, declared_by, ends_at)
  values (v_my_crew, p_target_crew_id, v_user, now() + (p_duration_days || ' days')::interval)
  returning id into v_war_id;

  return jsonb_build_object('ok', true, 'war_id', v_war_id,
    'ends_at', now() + (p_duration_days || ' days')::interval);
end $$;
grant execute on function public.declare_crew_war(uuid, int) to authenticated;

-- ─── 9) end_crew_war Cron-RPC ────────────────────────────────────────
create or replace function public.tick_end_due_crew_wars()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  w record;
begin
  for w in select * from public.crew_wars where status = 'active' and ends_at <= now() loop
    update public.crew_wars
       set status = 'ended',
           ended_at = now(),
           winner_crew = case
             when attacker_score > defender_score then attacker_crew
             when defender_score > attacker_score then defender_crew
             else null  -- Unentschieden
           end
     where id = w.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.tick_end_due_crew_wars() to authenticated, service_role;
