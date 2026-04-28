-- ════════════════════════════════════════════════════════════════════
-- CREW TURF — Phase 3: Street-Bounded Block-Turf
-- ════════════════════════════════════════════════════════════════════
-- Schluss mit Kreis-Coverage. Repeater claimen jetzt echte Stadt-Blocks
-- die zwischen Straßen entstehen — wie POG-Gyms ein "Häuserblock-Revier".
-- Felder pro Repeater-Typ:
--   HQ:        eigener Block + bis zu 8 Nachbar-Blocks (max 9 total)
--   Mega:      eigener Block + bis zu 3 Nachbar-Blocks (max 4 total)
--   Standard:  eigener Block (max 1 total)
-- Bei Konflikt (mehrere Crews wollen denselben Block):
--   gewinnt die mit der höchsten Block-Influence (Σ HP der claimenden Repeater).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) city_blocks: ETL-Output (zwischen Straßen entstandene Polygone) ──
create table if not exists public.city_blocks (
  id           bigserial primary key,
  geom         geometry(Polygon, 4326) not null,
  centroid     geometry(Point, 4326) not null,
  area_m2      double precision not null,
  -- "dominant_street_class" für Phase 3.4 Speed-Multiplier:
  --   'primary' = Hauptstraße (1.0× XP)
  --   'secondary' = Sammelstraße (0.9×)
  --   'residential' = Wohnstraße (0.8×)
  --   'pedestrian' = Fußgängerzone (0.6×)
  --   null = noch nicht klassifiziert
  street_class text,
  -- Quelle/ETL-Tracking
  source       text not null default 'osm_overpass',
  city         text,                          -- z.B. 'berlin'
  bbox_etl_at  timestamptz not null default now()
);

-- Spatial-Index ist Pflicht für Performance bei ST_Contains/Within Lookups
create index if not exists idx_city_blocks_geom on public.city_blocks using gist (geom);
create index if not exists idx_city_blocks_centroid on public.city_blocks using gist (centroid);
create index if not exists idx_city_blocks_city on public.city_blocks (city);

alter table public.city_blocks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='city_blocks' and policyname='city_blocks_read') then
    create policy city_blocks_read on public.city_blocks for select using (true);
  end if;
end $$;

-- ─── 2) ETL-Staging: rohe OSM-Ways aus Overpass (Phase 1 vom Polygonize) ──
create table if not exists public._etl_osm_ways (
  id     bigserial primary key,
  city   text not null,
  geom   geometry(LineString, 4326) not null,
  highway text,
  fetched_at timestamptz not null default now()
);
create index if not exists idx_etl_osm_ways_city on public._etl_osm_ways(city);
create index if not exists idx_etl_osm_ways_geom on public._etl_osm_ways using gist (geom);

-- ─── 3) repeater_block_claims: welcher Repeater hält welchen Block ──
create table if not exists public.repeater_block_claims (
  repeater_id  uuid not null references public.crew_repeaters(id) on delete cascade,
  block_id     bigint not null references public.city_blocks(id) on delete cascade,
  -- "influence" = HP des claimenden Repeaters (für Konflikt-Resolution)
  influence    int not null,
  primary key (repeater_id, block_id)
);
create index if not exists idx_rbc_block on public.repeater_block_claims(block_id);
create index if not exists idx_rbc_repeater on public.repeater_block_claims(repeater_id);

alter table public.repeater_block_claims enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='repeater_block_claims' and policyname='rbc_read_all') then
    create policy rbc_read_all on public.repeater_block_claims for select using (true);
  end if;
end $$;

-- ─── 4) Per-Kind Block-Claim-Anzahl ───────────────────────────────────
create or replace function public._repeater_block_count_for_kind(p_kind text)
returns int language sql immutable as $$
  select case p_kind
    when 'hq'       then 9    -- eigener + 8 Nachbarn
    when 'mega'     then 4    -- eigener + 3
    when 'repeater' then 1    -- nur eigener
    else 1
  end;
$$;

-- ─── 4b) ETL-RPC: Bulk-Insert von Ways (REST kann kein geometry direkt) ─
create or replace function public.etl_insert_ways(p_rows jsonb)
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public._etl_osm_ways (city, geom, highway)
    values (
      r->>'city',
      ST_GeomFromText(r->>'geom', 4326),
      r->>'highway'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.etl_insert_ways(jsonb) to service_role;

-- ─── 5) ETL-RPC: Polygonize von gestagten OSM-Ways → city_blocks ─────
-- Wird nach dem Insert von _etl_osm_ways aufgerufen. Nimmt alle Ways
-- einer City, baut MultiLineString, polygonisiert, filtert nach Größe,
-- inserted in city_blocks (idempotent: löscht erst bestehende Blocks
-- der City im bbox-Bereich).
create or replace function public.etl_polygonize_city_blocks(
  p_city text,
  p_min_area_m2 double precision default 200,
  p_max_area_m2 double precision default 200000
) returns jsonb language plpgsql security definer as $$
declare
  v_inserted int := 0;
  v_deleted int := 0;
  v_min_lng double precision;
  v_min_lat double precision;
  v_max_lng double precision;
  v_max_lat double precision;
begin
  -- BBox aus den gestagten Ways berechnen
  select ST_XMin(ST_Extent(geom)), ST_YMin(ST_Extent(geom)),
         ST_XMax(ST_Extent(geom)), ST_YMax(ST_Extent(geom))
    into v_min_lng, v_min_lat, v_max_lng, v_max_lat
    from public._etl_osm_ways where city = p_city;

  if v_min_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_staged_ways', 'city', p_city);
  end if;

  -- Bestehende Blocks im BBox löschen (idempotent re-run pro Bezirk)
  delete from public.city_blocks
   where city = p_city
     and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326));
  get diagnostics v_deleted = row_count;

  -- Polygonize: alle Ways → eine MultiLineString → Set von Polygonen
  insert into public.city_blocks (geom, centroid, area_m2, source, city)
    select
      poly.geom,
      ST_Centroid(poly.geom),
      ST_Area(poly.geom::geography),
      'osm_overpass',
      p_city
    from (
      select (ST_Dump(ST_Polygonize(geom_union))).geom
        from (
          select ST_Union(geom) as geom_union
            from public._etl_osm_ways
           where city = p_city
        ) u
    ) poly
    where ST_Area(poly.geom::geography) between p_min_area_m2 and p_max_area_m2;
  get diagnostics v_inserted = row_count;

  -- Staging-Tabelle leeren für die City (Speicher freigeben)
  delete from public._etl_osm_ways where city = p_city;

  return jsonb_build_object(
    'ok', true,
    'city', p_city,
    'deleted', v_deleted,
    'inserted', v_inserted,
    'bbox', jsonb_build_array(v_min_lng, v_min_lat, v_max_lng, v_max_lat)
  );
end $$;
grant execute on function public.etl_polygonize_city_blocks(text, double precision, double precision) to service_role;

-- ─── 6) Helper: Block-ID enthält einen Punkt ─────────────────────────
create or replace function public._block_id_at(p_lat double precision, p_lng double precision)
returns bigint language sql stable as $$
  select id from public.city_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
$$;

-- ─── 7) Helper: N nächste Nachbar-Blocks von einem Block ─────────────
-- Nachbarn = Blocks deren Geometrie den Ziel-Block berührt (ST_Touches),
-- alternativ falls ST_Touches leer ist, die N nächsten via Centroid-Distanz.
create or replace function public._neighbor_block_ids(p_block_id bigint, p_count int)
returns bigint[] language plpgsql stable as $$
declare
  v_geom geometry;
  v_neighbors bigint[];
begin
  if p_count <= 0 then return array[]::bigint[]; end if;
  select geom into v_geom from public.city_blocks where id = p_block_id;
  if v_geom is null then return array[]::bigint[]; end if;

  select array_agg(id order by ST_Distance(centroid, ST_Centroid(v_geom)))
    into v_neighbors
    from (
      select id, centroid from public.city_blocks
       where id <> p_block_id
         and ST_DWithin(geom::geography, v_geom::geography, 200)  -- max 200m bbox
       order by ST_Distance(centroid, ST_Centroid(v_geom))
       limit p_count
    ) n;

  return coalesce(v_neighbors, array[]::bigint[]);
end $$;

-- ─── 8) Recompute Claims für einen einzelnen Repeater ───────────────
-- Wird nach place/destroy aufgerufen. Macht:
--  1. Alte Claims dieses Repeaters löschen
--  2. Neuen Block am Repeater-Punkt finden
--  3. (kind-1) Nachbar-Blocks dazunehmen
--  4. Insert in repeater_block_claims mit influence = repeater.hp
create or replace function public.recompute_repeater_block_claims(p_repeater_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_repeater record;
  v_count int;
  v_home_block bigint;
  v_neighbors bigint[];
  v_inserted int := 0;
  v_b bigint;
begin
  -- Alte Claims dieses Repeaters wegräumen
  delete from public.repeater_block_claims where repeater_id = p_repeater_id;

  select id, kind, hp, lat, lng, destroyed_at
    into v_repeater
    from public.crew_repeaters
   where id = p_repeater_id;

  -- Nichts zu tun wenn zerstört oder nicht existent
  if v_repeater is null or v_repeater.destroyed_at is not null then
    return jsonb_build_object('ok', true, 'inserted', 0, 'reason', 'destroyed_or_missing');
  end if;

  v_count := public._repeater_block_count_for_kind(v_repeater.kind);
  v_home_block := public._block_id_at(v_repeater.lat, v_repeater.lng);

  if v_home_block is null then
    -- Repeater steht in keinem city_block (z.B. Park ohne Straßen) → kein Claim
    return jsonb_build_object('ok', true, 'inserted', 0, 'reason', 'no_home_block_at_position');
  end if;

  insert into public.repeater_block_claims (repeater_id, block_id, influence)
    values (p_repeater_id, v_home_block, v_repeater.hp);
  v_inserted := 1;

  if v_count > 1 then
    v_neighbors := public._neighbor_block_ids(v_home_block, v_count - 1);
    foreach v_b in array v_neighbors loop
      insert into public.repeater_block_claims (repeater_id, block_id, influence)
        values (p_repeater_id, v_b, v_repeater.hp)
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'home_block', v_home_block);
end $$;
grant execute on function public.recompute_repeater_block_claims(uuid) to authenticated;

-- ─── 9) place_crew_repeater: Hook → recompute_repeater_block_claims ──
-- Wir wrappen die existierende Funktion: nach erfolgreichem Insert noch
-- recompute aufrufen. Dafür ändern wir nicht die place_crew_repeater
-- selbst (zu invasiv) sondern nutzen einen AFTER-INSERT-Trigger.
create or replace function public._tg_repeater_recompute_claims()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.recompute_repeater_block_claims(NEW.id);
  elsif TG_OP = 'UPDATE' then
    -- destroyed_at gesetzt → claims löschen via recompute
    if OLD.destroyed_at is null and NEW.destroyed_at is not null then
      perform public.recompute_repeater_block_claims(NEW.id);
    -- HP-Änderung → influence updaten (recompute setzt influence = hp)
    elsif OLD.hp <> NEW.hp and NEW.destroyed_at is null then
      update public.repeater_block_claims set influence = NEW.hp where repeater_id = NEW.id;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists tg_repeater_recompute_claims on public.crew_repeaters;
create trigger tg_repeater_recompute_claims
  after insert or update on public.crew_repeaters
  for each row execute function public._tg_repeater_recompute_claims();

-- ─── 10) View: crew_block_control — wer kontrolliert welchen Block? ──
-- Konflikt-Resolution: Crew mit höchster Σ-Influence pro Block gewinnt.
-- Bei Gleichstand: niedrigere crew.id (deterministisch).
create or replace view public.crew_block_control as
  with by_crew as (
    select
      rbc.block_id,
      r.crew_id,
      sum(rbc.influence) as total_influence
    from public.repeater_block_claims rbc
    join public.crew_repeaters r on r.id = rbc.repeater_id and r.destroyed_at is null
    group by rbc.block_id, r.crew_id
  ),
  ranked as (
    select
      block_id,
      crew_id,
      total_influence,
      row_number() over (partition by block_id
                         order by total_influence desc, crew_id asc) as rk,
      count(*) over (partition by block_id) as crews_competing
    from by_crew
  )
  select
    block_id,
    crew_id,
    total_influence,
    crews_competing > 1 as is_contested
  from ranked
  where rk = 1;

grant select on public.crew_block_control to authenticated;

-- ─── 11) RPC: get_crew_blocks_in_bbox ────────────────────────────────
-- Ersetzt bei vollständigem Block-Daten-Bestand die get_crew_turf_polygons.
-- Liefert pro Block: GeoJSON, kontrollierende Crew, Farbe, Konflikt-Flag.
create or replace function public.get_crew_blocks_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  block_id bigint,
  crew_id uuid,
  crew_name text,
  is_own boolean,
  is_contested boolean,
  territory_color text,
  geojson jsonb
) language sql security definer as $$
  select
    cb.id as block_id,
    cbc.crew_id,
    c.name as crew_name,
    cbc.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own,
    cbc.is_contested,
    coalesce(c.territory_color, case
      when cbc.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
           then '#22D1C3'
      else '#FF2D78'
    end) as territory_color,
    ST_AsGeoJSON(cb.geom)::jsonb as geojson
  from public.crew_block_control cbc
  join public.city_blocks cb on cb.id = cbc.block_id
  join public.crews c on c.id = cbc.crew_id
  where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);
$$;
grant execute on function public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 12) Helper: Punkt im eigenen Crew-Block? ────────────────────────
-- Für Phase-2-Boni-Erweiterung: statt _user_in_own_crew_turf (Kreise)
-- alternativ _user_in_own_crew_block (echte Block-Kontrolle).
-- Wir lassen Phase 2 unangetastet und bieten diese Variante zusätzlich an.
create or replace function public._user_in_own_crew_block(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision
) returns boolean language sql stable as $$
  select coalesce(
    exists(
      select 1
        from public.city_blocks cb
        join public.crew_block_control cbc on cbc.block_id = cb.id
       where cbc.crew_id = (select crew_id from public.crew_members where user_id = p_user_id limit 1)
         and ST_Contains(cb.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    ),
    false
  );
$$;
grant execute on function public._user_in_own_crew_block(uuid, double precision, double precision) to authenticated;
