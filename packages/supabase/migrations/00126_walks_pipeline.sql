-- ════════════════════════════════════════════════════════════════════
-- WALKS-PIPELINE — Mirror territories→walks + Auto-Counter
-- ════════════════════════════════════════════════════════════════════
-- HINTERGRUND:
-- Beim "Lauf beenden" wird im Frontend in `public.territories` inserted
-- (Code: stopWalk in map-dashboard.tsx). Eine korrespondierende Row in
-- `public.walks` wird NIE geschrieben — daher bleibt walks leer und
-- alles was darauf basiert (record_walk_resources / Recent-Runs-Heatmap
-- / Drops / Adressen) hängt in der Luft.
--
-- Diese Migration:
--   1. Backfillt fehlende walks-Rows aus territories (für alle Bestands-Läufe)
--   2. Trigger spiegelt jeden NEUEN territory-Insert nach walks
--   3. Trigger zählt users.total_walks/total_distance_m bei walks-Insert hoch
--   4. Einmalige Re-Berechnung der User-Counter aus walks
-- ════════════════════════════════════════════════════════════════════

-- ─── Helper: route jsonb-Array → PostGIS LineString ───────────────────
create or replace function public._route_jsonb_to_linestring(p_route jsonb)
returns geometry language plpgsql immutable as $$
declare v_geom geometry;
begin
  if p_route is null then return null; end if;
  begin
    select ST_MakeLine(array_agg(
      ST_SetSRID(ST_MakePoint((p->>'lng')::float8, (p->>'lat')::float8), 4326)
      order by ord
    )) into v_geom
    from jsonb_array_elements(p_route) with ordinality as t(p, ord)
    where p ? 'lat' and p ? 'lng';
  exception when others then return null;
  end;
  -- LineString braucht ≥ 2 Punkte, sonst gibt's NULL zurück
  return v_geom;
end $$;

-- ─── 1) Backfill: territories → walks (vor allen Triggern) ────────────
insert into public.walks (
  user_id, started_at, ended_at, distance_m, duration_s, route,
  km_in_park, km_in_residential, km_in_commercial, km_near_water,
  drop_processed, created_at
)
select
  t.user_id,
  t.created_at - (coalesce(t.duration_s, 0) || ' seconds')::interval,
  t.created_at,
  coalesce(t.distance_m, 0),
  coalesce(t.duration_s, 0),
  case when jsonb_typeof(t.route::jsonb) = 'array'
       then public._route_jsonb_to_linestring(t.route::jsonb)
       else null end,
  0,
  coalesce(t.distance_m, 0) / 1000.0,  -- placeholder: alles als Wohngebiet
  0,
  0,
  true,                                  -- alte Läufe nicht nachträglich für Drops anstoßen
  t.created_at
from public.territories t
where not exists (
  select 1 from public.walks w
   where w.user_id = t.user_id
     and abs(extract(epoch from (w.created_at - t.created_at))) < 1
);

-- ─── 2) Trigger: territories-INSERT spiegelt nach walks ───────────────
create or replace function public._tg_territory_to_walk()
returns trigger language plpgsql security definer as $$
declare
  v_geom geometry;
  v_km   numeric;
begin
  if NEW.user_id is null then return NEW; end if;
  v_km := coalesce(NEW.distance_m, 0) / 1000.0;
  if NEW.route is not null then
    begin
      v_geom := public._route_jsonb_to_linestring(NEW.route::jsonb);
    exception when others then v_geom := null;
    end;
  end if;

  insert into public.walks (
    user_id, started_at, ended_at, distance_m, duration_s, route,
    km_in_park, km_in_residential, km_in_commercial, km_near_water,
    drop_processed, created_at
  ) values (
    NEW.user_id,
    NEW.created_at - (coalesce(NEW.duration_s, 0) || ' seconds')::interval,
    NEW.created_at,
    coalesce(NEW.distance_m, 0),
    coalesce(NEW.duration_s, 0),
    v_geom,
    0, v_km, 0, 0,
    false,                               -- frisch → record_walk_resources darf vergeben
    NEW.created_at
  );
  return NEW;
end $$;

drop trigger if exists tg_territory_to_walk on public.territories;
create trigger tg_territory_to_walk
  after insert on public.territories
  for each row execute function public._tg_territory_to_walk();

-- ─── 3) Trigger: walks-INSERT zählt User-Stats hoch ──────────────────
create or replace function public._tg_walks_inc_user_stats()
returns trigger language plpgsql security definer as $$
begin
  update public.users
     set total_walks      = coalesce(total_walks, 0) + 1,
         total_distance_m = coalesce(total_distance_m, 0) + coalesce(NEW.distance_m, 0),
         last_walk_at     = greatest(coalesce(last_walk_at, NEW.created_at), NEW.created_at),
         updated_at       = now()
   where id = NEW.user_id;
  return NEW;
end $$;

drop trigger if exists tg_walks_inc_user_stats on public.walks;
create trigger tg_walks_inc_user_stats
  after insert on public.walks
  for each row execute function public._tg_walks_inc_user_stats();

-- ─── 4) Einmalige Re-Berechnung aller User-Counter aus walks ─────────
-- Da der Counter-Trigger erst jetzt aktiv wird, holen wir Bestandswerte
-- einmalig aus der jetzt befüllten walks-Tabelle nach.
update public.users u
   set total_walks      = sub.cnt,
       total_distance_m = sub.dist,
       last_walk_at     = sub.last_at
  from (
    select user_id,
           count(*)::int as cnt,
           coalesce(sum(distance_m), 0)::int as dist,
           max(created_at) as last_at
      from public.walks
     group by user_id
  ) sub
 where u.id = sub.user_id;
