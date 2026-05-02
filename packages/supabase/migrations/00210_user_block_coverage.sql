-- ══════════════════════════════════════════════════════════════════════════
-- Phase 1 — Berlin-Heatmap: persönliche Block-Coverage
--
-- Liefert pro User: wie viele Berliner Kieze (neighborhood_blocks) er schon
-- mit seinen Walks berührt hat — Total + Gelaufen + Prozent + IDs für Render.
--
-- Berührt = walks.route (LineString) intersected mit neighborhood_blocks.geom.
-- Für Performance ein GiST-Index auf walks.route falls nicht vorhanden.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Index falls noch nicht da (idempotent) ──────────────────────────────
create index if not exists idx_walks_route_gist on public.walks using gist (route);

-- ── RPC: get_user_block_coverage ────────────────────────────────────────
-- Gibt Stats + Block-IDs zurück. Cached pro User per session-cache wäre
-- ideal, aber für v1 reicht direkter Query (152 blocks × N walks pro user
-- ist günstig dank GiST).
create or replace function public.get_user_block_coverage(p_user_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_total int;
  v_covered_ids bigint[];
  v_covered int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  select count(*) into v_total from public.neighborhood_blocks;

  select array_agg(distinct nb.id)
    into v_covered_ids
    from public.neighborhood_blocks nb
    join public.walks w on st_intersects(nb.geom, w.route)
   where w.user_id = v_user;

  v_covered := coalesce(array_length(v_covered_ids, 1), 0);

  return jsonb_build_object(
    'ok', true,
    'total_blocks', v_total,
    'covered_blocks', v_covered,
    'percent', case when v_total > 0 then round(100.0 * v_covered / v_total, 1) else 0 end,
    'covered_ids', coalesce(to_jsonb(v_covered_ids), '[]'::jsonb)
  );
end $$;

revoke all on function public.get_user_block_coverage(uuid) from public;
grant execute on function public.get_user_block_coverage(uuid) to authenticated;

-- ── RPC: get_block_coverage_geojson ─────────────────────────────────────
-- Liefert die berührten Blocks als GeoJSON-FeatureCollection für Heatmap-Render
-- (verwendet ST_AsGeoJSON). Für 152 Blocks ohne weiteres ok payload-mäßig.
create or replace function public.get_block_coverage_geojson(p_user_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_features jsonb;
begin
  if v_user is null then
    return jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature',
    'id', nb.id,
    'geometry', st_asgeojson(nb.geom)::jsonb,
    'properties', jsonb_build_object(
      'covered', exists (
        select 1 from public.walks w
         where w.user_id = v_user and st_intersects(nb.geom, w.route)
      ),
      'area_m2', nb.area_m2
    )
  )), '[]'::jsonb)
    into v_features
    from public.neighborhood_blocks nb;

  return jsonb_build_object('type', 'FeatureCollection', 'features', v_features);
end $$;

revoke all on function public.get_block_coverage_geojson(uuid) from public;
grant execute on function public.get_block_coverage_geojson(uuid) to authenticated;
