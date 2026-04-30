-- ══════════════════════════════════════════════════════════════════════════
-- MVT Vector-Tile-RPCs für Map-Layer mit vielen Entities (Skalierung 10k+)
-- ST_AsMVT erzeugt Mapbox-kompatible Vector-Tiles serverseitig.
-- Client kann via 'vector'-Source nur sichtbare Tiles laden statt full-bbox-GeoJSON.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── resource_nodes als MVT ────────────────────────────────────────────
create or replace function public.tile_resource_nodes(z int, x int, y int)
returns bytea language plpgsql security definer stable as $$
declare
  v_env_3857 geometry := st_tileenvelope(z, x, y);
  v_env_4326 geometry := st_transform(v_env_3857, 4326);
  v_mvt bytea;
begin
  with mvtgeom as (
    select
      st_asmvtgeom(
        st_transform(geom, 3857),
        v_env_3857,
        4096, 64, true
      ) as geom,
      id, kind, resource_type, level,
      current_yield, total_yield
    from public.resource_nodes
    where depleted_at is null
      and geom is not null
      and geom && v_env_4326
    limit 2000
  )
  select st_asmvt(mvtgeom, 'resource_nodes', 4096, 'geom') into v_mvt from mvtgeom;
  return v_mvt;
end $$;
revoke all on function public.tile_resource_nodes(int, int, int) from public;
grant execute on function public.tile_resource_nodes(int, int, int) to authenticated, anon;

-- ─── strongholds als MVT ───────────────────────────────────────────────
create or replace function public.tile_strongholds(z int, x int, y int)
returns bytea language plpgsql security definer stable as $$
declare
  v_env_3857 geometry := st_tileenvelope(z, x, y);
  v_env_4326 geometry := st_transform(v_env_3857, 4326);
  v_mvt bytea;
begin
  with mvtgeom as (
    select
      st_asmvtgeom(
        st_transform(geom, 3857),
        v_env_3857,
        4096, 64, true
      ) as geom,
      id, level, total_hp, current_hp, plz
    from public.strongholds
    where defeated_at is null
      and geom is not null
      and geom && v_env_4326
    limit 2000
  )
  select st_asmvt(mvtgeom, 'strongholds', 4096, 'geom') into v_mvt from mvtgeom;
  return v_mvt;
end $$;
revoke all on function public.tile_strongholds(int, int, int) from public;
grant execute on function public.tile_strongholds(int, int, int) to authenticated, anon;

-- ─── bases als MVT (runner + crew) ─────────────────────────────────────
create or replace function public.tile_bases(z int, x int, y int)
returns bytea language plpgsql security definer stable as $$
declare
  v_env_3857 geometry := st_tileenvelope(z, x, y);
  v_env_4326 geometry := st_transform(v_env_3857, 4326);
  v_mvt bytea;
begin
  with mvtgeom as (
    select
      st_asmvtgeom(
        st_transform(geom, 3857),
        v_env_3857,
        4096, 64, true
      ) as geom,
      id, level, theme_id,
      'runner' as kind
    from public.bases
    where geom is not null and geom && v_env_4326
    union all
    select
      st_asmvtgeom(
        st_transform(geom, 3857),
        v_env_3857,
        4096, 64, true
      ) as geom,
      id, level, theme_id,
      'crew' as kind
    from public.crew_bases
    where geom is not null and geom && v_env_4326
    limit 2000
  )
  select st_asmvt(mvtgeom, 'bases', 4096, 'geom') into v_mvt from mvtgeom;
  return v_mvt;
end $$;
revoke all on function public.tile_bases(int, int, int) from public;
grant execute on function public.tile_bases(int, int, int) to authenticated, anon;
