-- ════════════════════════════════════════════════════════════════════
-- HEIMAT-KARTE: Map-Markierungen (persönlich + crew)
-- ════════════════════════════════════════════════════════════════════
-- - user_map_markers: persönliche Pins (Allgemein/Freunde/Gegner)
-- - crew_map_markers: Crew-Aktionen (Angriff/Heilung/Schild/Sammeln/...)
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.user_map_markers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  category text not null check (category in ('allgemein','freunde','gegner')),
  label text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_ump_user on public.user_map_markers (user_id, created_at desc);
create index if not exists ix_ump_geo on public.user_map_markers (lat, lng);
alter table public.user_map_markers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_map_markers' and policyname='ump_read_own') then
    create policy ump_read_own on public.user_map_markers for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_map_markers' and policyname='ump_insert_own') then
    create policy ump_insert_own on public.user_map_markers for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_map_markers' and policyname='ump_delete_own') then
    create policy ump_delete_own on public.user_map_markers for delete using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.crew_map_markers (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  -- action_kind: angriff/verteidigen/warnung/sammeln/aufbauen/heilen/schild/ziel/wichtig
  action_kind text not null,
  label text,
  is_urgent boolean not null default false,
  cost_paid jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_cmm_crew on public.crew_map_markers (crew_id, created_at desc);
create index if not exists ix_cmm_geo on public.crew_map_markers (lat, lng);
create index if not exists ix_cmm_active on public.crew_map_markers (crew_id, expires_at);
alter table public.crew_map_markers enable row level security;
do $$ begin
  -- Crew-Member sehen alle Marker ihrer Crew
  if not exists (select 1 from pg_policies where tablename='crew_map_markers' and policyname='cmm_read_crew') then
    create policy cmm_read_crew on public.crew_map_markers
      for select using (
        exists (
          select 1 from public.crew_members cm
           where cm.user_id = auth.uid() and cm.crew_id = crew_map_markers.crew_id
        )
      );
  end if;
  -- Crew-Member dürfen ihrer Crew Marker setzen
  if not exists (select 1 from pg_policies where tablename='crew_map_markers' and policyname='cmm_insert_crew') then
    create policy cmm_insert_crew on public.crew_map_markers
      for insert with check (
        exists (
          select 1 from public.crew_members cm
           where cm.user_id = auth.uid() and cm.crew_id = crew_map_markers.crew_id
        )
      );
  end if;
  -- Ersteller darf eigene Marker löschen
  if not exists (select 1 from pg_policies where tablename='crew_map_markers' and policyname='cmm_delete_own') then
    create policy cmm_delete_own on public.crew_map_markers
      for delete using (auth.uid() = created_by);
  end if;
end $$;

-- ─── RPC: place_crew_marker ───────────────────────────────────────────
-- Limit: 20 aktive Marker pro Crew, Kosten 5000 Krypto bei is_urgent.
create or replace function public.place_crew_marker(
  p_lat double precision,
  p_lng double precision,
  p_action_kind text,
  p_label text default null,
  p_is_urgent boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_active_count int;
  v_marker_id uuid;
  v_cost_gold int := 0;
  v_user_gold int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  if p_action_kind not in ('angriff','verteidigen','warnung','sammeln','aufbauen','heilen','schild','ziel','wichtig') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action_kind');
  end if;

  select count(*)::int into v_active_count
    from public.crew_map_markers
   where crew_id = v_crew and (expires_at is null or expires_at > now());
  if v_active_count >= 20 then
    return jsonb_build_object('ok', false, 'error', 'marker_limit_reached', 'active', v_active_count, 'limit', 20);
  end if;

  if p_is_urgent then
    v_cost_gold := 5000;
    select gold into v_user_gold from public.user_resources where user_id = v_user;
    if coalesce(v_user_gold, 0) < v_cost_gold then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'need', v_cost_gold, 'have', coalesce(v_user_gold, 0));
    end if;
    update public.user_resources set gold = gold - v_cost_gold where user_id = v_user;
  end if;

  insert into public.crew_map_markers (
    crew_id, created_by, lat, lng, action_kind, label, is_urgent, cost_paid,
    expires_at
  ) values (
    v_crew, v_user, p_lat, p_lng, p_action_kind, p_label, p_is_urgent,
    case when v_cost_gold > 0 then jsonb_build_object('gold', v_cost_gold) else null end,
    now() + interval '24 hours'
  ) returning id into v_marker_id;

  return jsonb_build_object('ok', true, 'marker_id', v_marker_id, 'active', v_active_count + 1, 'limit', 20);
end $$;
revoke all on function public.place_crew_marker(double precision, double precision, text, text, boolean) from public;
grant execute on function public.place_crew_marker(double precision, double precision, text, text, boolean) to authenticated;

-- ─── RPC: heimat_poi_at(lat, lng) ─────────────────────────────────────
-- Liefert Crew-Owner-Info + nearby base in einem Call.
create or replace function public.heimat_poi_at(
  p_lat double precision,
  p_lng double precision
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_crew_id uuid;
  v_owner_crew_name text;
  v_owner_crew_tag text;
  v_owner_crew_color text;
  v_nearby_base record;
  v_in_crew_turf boolean := false;
begin
  -- 1) Crew-Turf check über Repeater-Buffer
  for v_owner_crew_id in
    select cr.crew_id
      from public.crew_repeaters cr
     where cr.lat between p_lat - 0.01 and p_lat + 0.01
       and cr.lng between p_lng - 0.01 and p_lng + 0.01
       and cr.hp > 0
     order by sqrt(power(cr.lat - p_lat, 2) + power(cr.lng - p_lng, 2)) asc
     limit 1
  loop
    if public._point_in_crew_turf(v_owner_crew_id, p_lat, p_lng) then
      v_in_crew_turf := true;
      exit;
    end if;
  end loop;

  if v_in_crew_turf and v_owner_crew_id is not null then
    select name, tag, territory_color
      into v_owner_crew_name, v_owner_crew_tag, v_owner_crew_color
      from public.crews where id = v_owner_crew_id;
  end if;

  -- 2) Fallback: territory_polygons (Walk-basierte Claims) — vereinfacht via bbox
  if not v_in_crew_turf then
    select tp.owner_crew_id
      into v_owner_crew_id
      from public.territory_polygons tp
     where tp.status in ('active', 'pending_crew')
       and tp.owner_crew_id is not null
       and exists (
         select 1 from jsonb_array_elements(to_jsonb(tp.polygon)) p
          where (p->>'lat')::float between p_lat - 0.005 and p_lat + 0.005
            and (p->>'lng')::float between p_lng - 0.005 and p_lng + 0.005
       )
     order by tp.last_painted_at desc nulls last
     limit 1;

    if v_owner_crew_id is not null then
      select name, tag, territory_color
        into v_owner_crew_name, v_owner_crew_tag, v_owner_crew_color
        from public.crews where id = v_owner_crew_id;
    end if;
  end if;

  -- 3) Nächste Spieler-Base in 100m
  select b.owner_user_id, u.display_name, b.lat, b.lng,
         6371000 * 2 * asin(sqrt(
           power(sin(radians((b.lat - p_lat) / 2)), 2) +
           cos(radians(p_lat)) * cos(radians(b.lat)) *
           power(sin(radians((b.lng - p_lng) / 2)), 2)
         )) as dist_m
    into v_nearby_base
    from public.bases b
    join public.users u on u.id = b.owner_user_id
   where b.lat between p_lat - 0.002 and p_lat + 0.002
     and b.lng between p_lng - 0.002 and p_lng + 0.002
   order by dist_m asc
   limit 1;

  return jsonb_build_object(
    'owner_crew_id', v_owner_crew_id,
    'owner_crew_name', v_owner_crew_name,
    'owner_crew_tag', v_owner_crew_tag,
    'owner_crew_color', v_owner_crew_color,
    'nearby_base', case when v_nearby_base.owner_user_id is not null then jsonb_build_object(
      'user_id', v_nearby_base.owner_user_id,
      'display_name', v_nearby_base.display_name,
      'distance_m', round((v_nearby_base.dist_m)::numeric)::int,
      'lat', v_nearby_base.lat,
      'lng', v_nearby_base.lng
    ) else null end
  );
end $$;
revoke all on function public.heimat_poi_at(double precision, double precision) from public;
grant execute on function public.heimat_poi_at(double precision, double precision) to authenticated;
