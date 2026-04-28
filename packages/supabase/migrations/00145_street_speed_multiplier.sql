-- ════════════════════════════════════════════════════════════════════
-- PHASE 3.4 — Street-Speed-Multiplier
-- ════════════════════════════════════════════════════════════════════
-- Walks bekommen einen XP/Resource-Multiplier abhängig von der dominanten
-- Straßen-Klasse der Blocks die sie durchqueren:
--   primary/secondary  = 1.0×  (volle Stadt-XP)
--   residential        = 0.85× (Wohnstraßen — bisschen weniger Action)
--   pedestrian/service = 0.6×  (Fußgängerzonen + Service-Wege)
--   keine Block-Daten  = 1.0×  (Fallback)
--
-- Klassifizierung: in den ETL-Schritt einbauen wäre besser, aber wir
-- können das auch nachträglich ableiten via Distanz zur Block-Grenze.
-- Der einfachste Ansatz: pro Block den dominanten highway-Tag der
-- Begrenzungs-Ways speichern. Dafür brauchen wir die Highway-Info aus
-- _etl_osm_ways → city_blocks.street_class.
-- Da der ETL-Schritt diese Info aktuell nicht propagiert, machen wir
-- einen Bulk-Update via Spatial-Join: für jeden Block den höchstrangigen
-- highway-Tag der ihn berührenden Ways.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Street-Class-Ranking (höher = mehr XP-wert) ──────────────────
create or replace function public._street_class_rank(p_class text)
returns int language sql immutable as $$
  select case p_class
    when 'motorway'      then 6
    when 'trunk'         then 6
    when 'primary'       then 5
    when 'secondary'     then 4
    when 'tertiary'      then 3
    when 'residential'   then 2
    when 'unclassified'  then 2
    when 'living_street' then 1
    when 'pedestrian'    then 1
    when 'service'       then 0
    else 0
  end;
$$;

create or replace function public._street_class_xp_mult(p_class text)
returns numeric language sql immutable as $$
  select case
    when p_class in ('motorway','trunk','primary','secondary') then 1.0
    when p_class in ('tertiary','residential','unclassified') then 0.85
    when p_class in ('living_street','pedestrian')             then 0.7
    when p_class in ('service')                                then 0.6
    else 1.0
  end;
$$;

-- ─── 2) Klassifikations-Job: nachträglich Blocks dominanten Tag geben ─
-- Iteriert über alle city_blocks ohne street_class und holt den höchst-
-- rangigen Tag aus den staged _etl_osm_ways die den Block berühren.
-- (Funktioniert nur direkt nach ETL solange _etl_osm_ways noch befüllt ist
--  — daher müssen ETL-Aufrufer diese Funktion vor etl_polygonize_city_blocks
--  oder unmittelbar danach mit BBox-Begrenzung aufrufen.)
-- Für Re-Run nach späterem ETL: wir nutzen einen Trick und behalten
-- die Highway-Info in einem persistenten Mapping.

-- Persistente Highway-Info pro Block via Recompute aus angrenzenden ways
-- Wir brauchen aber die ways. Da sie nach Polygonize gelöscht werden
-- machen wir einen modifizierten Polygonize-Workflow:
-- KOMPROMISS: street_class wird beim Polygonize direkt gesetzt indem wir
-- den dominanten Tag der berührenden Ways nehmen, BEVOR die Staging-Tabelle
-- geleert wird.

-- Wir patchen etl_polygonize_city_blocks um diesen Schritt:
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
  v_classified int := 0;
begin
  select ST_XMin(ST_Extent(geom)), ST_YMin(ST_Extent(geom)),
         ST_XMax(ST_Extent(geom)), ST_YMax(ST_Extent(geom))
    into v_min_lng, v_min_lat, v_max_lng, v_max_lat
    from public._etl_osm_ways where city = p_city;

  if v_min_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_staged_ways', 'city', p_city);
  end if;

  delete from public.city_blocks
   where city = p_city
     and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326));
  get diagnostics v_deleted = row_count;

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

  -- street_class setzen: pro Block den höchstrangigen Highway-Tag der
  -- Ways die den Block-Rand berühren (ST_Touches/Intersects).
  with new_blocks as (
    select id, geom from public.city_blocks
     where city = p_city and street_class is null
       and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326))
  ),
  best as (
    select nb.id as block_id,
           (array_agg(ow.highway order by public._street_class_rank(ow.highway) desc nulls last))[1] as best_class
      from new_blocks nb
      join public._etl_osm_ways ow on ow.city = p_city
                                   and ST_Intersects(ow.geom, nb.geom)
     group by nb.id
  )
  update public.city_blocks cb
     set street_class = b.best_class
    from best b
   where cb.id = b.block_id;
  get diagnostics v_classified = row_count;

  delete from public._etl_osm_ways where city = p_city;

  return jsonb_build_object(
    'ok', true,
    'city', p_city,
    'deleted', v_deleted,
    'inserted', v_inserted,
    'classified', v_classified,
    'bbox', jsonb_build_array(v_min_lng, v_min_lat, v_max_lng, v_max_lat)
  );
end $$;
grant execute on function public.etl_polygonize_city_blocks(text, double precision, double precision) to service_role;

-- ─── 3) record_walk_resources: Street-Multiplier on top ──────────────
-- Erweitert um Block-Klasse-Multiplier am Walk-Endpunkt.
-- Stack: VIP × Crew-Turf × Street-Class.
create or replace function public.record_walk_resources(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_walk record;
  v_user uuid := auth.uid();
  v_wood int; v_stone int; v_gold int; v_mana int; v_tokens int;
  v_vip_bonus numeric := 0;
  v_total_km numeric;
  v_bonuses jsonb := '[]'::jsonb;
  v_vip_extra_xp int;
  v_end_point geometry;
  v_end_lat double precision;
  v_end_lng double precision;
  v_in_own_turf boolean := false;
  v_turf_bonus_pct numeric := 0;
  v_turf_token_bonus_pct numeric := 0;
  v_extra_rss int;
  v_extra_tokens int;
  v_block_class text;
  v_street_mult numeric := 1.0;
  v_street_extra int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_walk from public.walks where id = p_walk_id and user_id = v_user;
  if v_walk is null then return jsonb_build_object('ok', false, 'error', 'walk_not_found'); end if;
  if v_walk.drop_processed then return jsonb_build_object('ok', false, 'error', 'already_processed'); end if;

  select coalesce(t.resource_bonus_pct, 0) into v_vip_bonus
    from public.vip_progress p
    left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  if v_walk.route is not null then
    begin
      v_end_point := ST_EndPoint(v_walk.route);
      if v_end_point is not null then
        v_end_lat := ST_Y(v_end_point);
        v_end_lng := ST_X(v_end_point);
        v_in_own_turf := public._user_in_own_crew_turf(v_user, v_end_lat, v_end_lng);
        -- Street-Class am Endpunkt (falls Block-Daten existieren)
        select cb.street_class into v_block_class
          from public.city_blocks cb
         where ST_Contains(cb.geom, v_end_point)
         limit 1;
        if v_block_class is not null then
          v_street_mult := public._street_class_xp_mult(v_block_class);
        end if;
      end if;
    exception when others then v_in_own_turf := false;
    end;
  end if;

  if v_in_own_turf then
    v_turf_bonus_pct := 0.25;
    v_turf_token_bonus_pct := 0.15;
  end if;

  v_wood  := round(v_walk.km_in_park        * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct) * v_street_mult);
  v_stone := round(v_walk.km_in_residential * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct) * v_street_mult);
  v_gold  := round(v_walk.km_in_commercial  * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct) * v_street_mult);
  v_mana  := round(v_walk.km_near_water     * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct) * v_street_mult);

  v_total_km := coalesce(v_walk.distance_m, 0) / 1000.0;
  v_tokens := floor(v_total_km * (1 + v_turf_token_bonus_pct))::int;

  if v_vip_bonus > 0 then
    v_vip_extra_xp := round((v_wood + v_stone + v_gold + v_mana) * v_vip_bonus / (1 + v_vip_bonus))::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'vip_resource_bonus',
      'label', 'Premium-Bonus auf Ressourcen',
      'pct', round(v_vip_bonus * 100, 1),
      'extra_amount', v_vip_extra_xp,
      'unit', 'rss'
    );
  end if;

  if v_in_own_turf then
    v_extra_rss := round((v_wood + v_stone + v_gold + v_mana) * v_turf_bonus_pct / (1 + v_turf_bonus_pct))::int;
    v_extra_tokens := v_tokens - floor(v_total_km)::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'crew_turf_bonus',
      'label', 'Crew-Turf-Bonus (eigenes Gebiet)',
      'pct', 25,
      'extra_amount', v_extra_rss,
      'unit', 'rss'
    );
    if v_extra_tokens > 0 then
      v_bonuses := v_bonuses || jsonb_build_object(
        'kind', 'crew_turf_token_bonus',
        'label', 'Crew-Turf-Bonus auf Wegemünzen',
        'pct', 15,
        'extra_amount', v_extra_tokens,
        'unit', 'tokens'
      );
    end if;
  end if;

  -- Street-Class-Bonus (positiv oder negativ vs 1.0)
  if v_street_mult <> 1.0 then
    v_street_extra := round((v_wood + v_stone + v_gold + v_mana) * (v_street_mult - 1) / v_street_mult)::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'street_class',
      'label', case
        when v_street_mult > 1 then 'Hauptstraßen-Bonus'
        when v_street_mult >= 0.85 then 'Wohnstraßen (leichter Abzug)'
        when v_street_mult >= 0.7 then 'Fußgängerzone (Abzug)'
        else 'Service-Weg (starker Abzug)'
      end,
      'pct', round((v_street_mult - 1) * 100, 1),
      'extra_amount', v_street_extra,
      'unit', 'rss',
      'street_class', v_block_class
    );
  end if;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_wood, v_stone, v_gold, v_mana, v_tokens)
  on conflict (user_id) do update set
    wood         = public.user_resources.wood + excluded.wood,
    stone        = public.user_resources.stone + excluded.stone,
    gold         = public.user_resources.gold + excluded.gold,
    mana         = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at   = now();

  update public.walks set
    wood_dropped   = v_wood,
    stone_dropped  = v_stone,
    gold_dropped   = v_gold,
    mana_dropped   = v_mana,
    tokens_dropped = v_tokens,
    xp_bonuses     = coalesce(xp_bonuses, '[]'::jsonb) || v_bonuses,
    drop_processed = true
  where id = p_walk_id;

  return jsonb_build_object('ok', true,
    'wood', v_wood, 'stone', v_stone, 'gold', v_gold, 'mana', v_mana,
    'tokens', v_tokens, 'bonuses', v_bonuses,
    'in_own_turf', v_in_own_turf,
    'street_class', v_block_class,
    'street_mult', v_street_mult);
end $$;
revoke all on function public.record_walk_resources(uuid) from public;
grant execute on function public.record_walk_resources(uuid) to authenticated;
