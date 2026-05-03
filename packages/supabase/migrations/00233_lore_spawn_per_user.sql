-- ─── 00233: Lore-Pieces pro User in dessen Stadt spawnen ──────────────
-- Pieces sind global definiert (lore_pieces katalog), Spawn-Coords aber pro
-- User in seiner Stadt gestreut — Anker = user's Base-Position. Radius ~6 km
-- (typische Stadt-Größe), zufällig verteilt sodass der Runner reisen muss.
-- Pickup nur bei physischer Nähe (≤30 m, im pickup_lore_piece RPC geprüft).

create table if not exists public.user_lore_piece_spawns (
  user_id    uuid not null references auth.users(id) on delete cascade,
  piece_id   text not null references public.lore_pieces(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  spawned_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);
alter table public.user_lore_piece_spawns enable row level security;
drop policy if exists "select_own_lore_spawns" on public.user_lore_piece_spawns;
create policy "select_own_lore_spawns" on public.user_lore_piece_spawns
  for select using (auth.uid() = user_id);

-- ─── Ensure-Spawn: für aktuellen User alle fehlenden Pieces in Radius spawnen ─
-- Nutzt user's Base als Anker. Falls keine Base → Fallback auf zuletzt bekannte
-- Walk-Position über walks.start_lat/start_lng. Falls auch das fehlt → no-op.
create or replace function public.ensure_user_lore_spawns(p_radius_km double precision default 6.0)
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_lat  double precision;
  v_lng  double precision;
  v_count int := 0;
  r record;
  v_offset_m double precision;
  v_bearing  double precision;
  v_dlat     double precision;
  v_dlng     double precision;
  v_min_m    double precision := 400;  -- mindest-Streuung damit nicht alles im Spawn-Punkt liegt
begin
  if v_user is null then return 0; end if;

  -- Anker: eigene Base
  select lat, lng into v_lat, v_lng
  from public.bases where owner_user_id = v_user
  order by created_at limit 1;

  -- Fallback: letzter Walk-Start
  if v_lat is null then
    select start_lat, start_lng into v_lat, v_lng
    from public.walks where user_id = v_user
    order by started_at desc nulls last limit 1;
  end if;

  if v_lat is null then return 0; end if;

  -- Für jedes Piece, das diesem User noch nicht zugeordnet ist, einen
  -- zufälligen Spawn-Punkt im Radius generieren (Polar-Koordinaten).
  for r in
    select lp.id from public.lore_pieces lp
    left join public.user_lore_piece_spawns s
      on s.piece_id = lp.id and s.user_id = v_user
    where s.piece_id is null
  loop
    -- gleichmäßige Flächenverteilung: sqrt(random()) für radius
    v_offset_m := v_min_m + sqrt(random()) * (p_radius_km * 1000.0 - v_min_m);
    v_bearing  := random() * 2 * pi();
    -- ~111 km pro Grad lat; lng skaliert mit cos(lat)
    v_dlat := (v_offset_m * cos(v_bearing)) / 111000.0;
    v_dlng := (v_offset_m * sin(v_bearing)) / (111000.0 * cos(radians(v_lat)));
    insert into public.user_lore_piece_spawns (user_id, piece_id, lat, lng)
    values (v_user, r.id, v_lat + v_dlat, v_lng + v_dlng);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.ensure_user_lore_spawns(double precision) to authenticated;

-- ─── pickup_lore_piece um Distanz-Check erweitern ─────────────────────
-- Client schickt seine aktuelle Position mit; Server prüft ≤ 30 m gegen Spawn.
create or replace function public.pickup_lore_piece(
  p_piece_id text,
  p_user_lat double precision default null,
  p_user_lng double precision default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_spawn record;
  v_dist_m double precision;
  v_set_id text;
  v_set_complete boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  -- bereits gefunden?
  if exists (select 1 from public.user_lore_pieces where user_id = v_user and piece_id = p_piece_id) then
    return jsonb_build_object('ok', false, 'error', 'already_found');
  end if;

  -- Spawn vorhanden?
  select * into v_spawn from public.user_lore_piece_spawns
  where user_id = v_user and piece_id = p_piece_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_spawn'); end if;

  -- Distanz-Check (Haversine, ~30 m)
  if p_user_lat is null or p_user_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_position');
  end if;
  v_dist_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians((p_user_lat - v_spawn.lat) / 2)), 2) +
    cos(radians(v_spawn.lat)) * cos(radians(p_user_lat)) *
    power(sin(radians((p_user_lng - v_spawn.lng) / 2)), 2)
  ));
  if v_dist_m > 30 then
    return jsonb_build_object('ok', false, 'error', 'too_far', 'distance_m', round(v_dist_m)::int);
  end if;

  insert into public.user_lore_pieces (user_id, piece_id) values (v_user, p_piece_id);

  -- Set komplett?
  select set_id into v_set_id from public.lore_pieces where id = p_piece_id;
  v_set_complete := (
    select count(*) = (select count(*) from public.lore_pieces where set_id = v_set_id)
    from public.user_lore_pieces ulp
    join public.lore_pieces lp on lp.id = ulp.piece_id
    where ulp.user_id = v_user and lp.set_id = v_set_id
  );

  return jsonb_build_object('ok', true, 'set_id', v_set_id, 'set_complete', v_set_complete);
end $$;
grant execute on function public.pickup_lore_piece(text, double precision, double precision) to authenticated;
