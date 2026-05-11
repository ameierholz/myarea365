-- 00353_sanctuary_urban_spawn.sql
-- Sanctuaries spawnten zu oft am Bezirks-Rand in Wald/Wasser (Bounding-Box-
-- Random + ST_Contains). Lösung: Random-Point innerhalb des Bezirks UND
-- innerhalb urbaner city_terrain_polygons (residential/commercial/tourism/
-- university/government). Fallback auf reines random_point_in_district wenn
-- keine urbanen Polygone in dem Bezirk (z. B. neue Stadt ohne OSM-Import).

CREATE OR REPLACE FUNCTION public.random_point_in_district_urban(
  p_district_id bigint,
  OUT lat double precision,
  OUT lng double precision
)
RETURNS record LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_geom extensions.geometry;
  v_city text;
  v_clip extensions.geometry;
  v_env extensions.geometry;
  v_xmin double precision; v_xmax double precision;
  v_ymin double precision; v_ymax double precision;
  v_pt extensions.geometry;
  i int := 0;
begin
  select geom, city_slug into v_geom, v_city
  from public.city_districts where id = p_district_id;
  if v_geom is null then return; end if;

  -- Urbane Polygone in DIESEM Bezirk zusammenfassen (mit Buffer 0 für Geometrie-Cleanup)
  select extensions.ST_Buffer(extensions.ST_Union(p.geom), 0) into v_clip
  from public.city_terrain_polygons p
  where p.city_slug = v_city
    and p.primary_tag in ('residential','commercial','tourism','university','government','park')
    and extensions.ST_Intersects(p.geom, v_geom);

  -- Wenn keine urbanen Polygone → reines Bezirks-Random
  if v_clip is null or extensions.ST_IsEmpty(v_clip) then
    select r.lat, r.lng into lat, lng from public.random_point_in_district(p_district_id) r;
    return;
  end if;

  -- Schnittmenge District ∩ Urban
  v_clip := extensions.ST_Intersection(v_geom, v_clip);
  if extensions.ST_IsEmpty(v_clip) then
    select r.lat, r.lng into lat, lng from public.random_point_in_district(p_district_id) r;
    return;
  end if;

  v_env := extensions.ST_Envelope(v_clip);
  v_xmin := extensions.ST_XMin(v_env);
  v_xmax := extensions.ST_XMax(v_env);
  v_ymin := extensions.ST_YMin(v_env);
  v_ymax := extensions.ST_YMax(v_env);

  while i < 200 loop
    v_pt := extensions.ST_SetSRID(extensions.ST_MakePoint(
      v_xmin + random() * (v_xmax - v_xmin),
      v_ymin + random() * (v_ymax - v_ymin)
    ), 4326);
    if extensions.ST_Contains(v_clip, v_pt) then
      lng := extensions.ST_X(v_pt);
      lat := extensions.ST_Y(v_pt);
      return;
    end if;
    i := i + 1;
  end loop;

  -- Fallback: PointOnSurface der Schnittmenge
  v_pt := extensions.ST_PointOnSurface(v_clip);
  lng := extensions.ST_X(v_pt);
  lat := extensions.ST_Y(v_pt);
end $$;

GRANT EXECUTE ON FUNCTION public.random_point_in_district_urban(bigint) TO authenticated, service_role;

-- rotate_sanctuaries auf urban-Variante umstellen
CREATE OR REPLACE FUNCTION public.rotate_sanctuaries()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  d record;
  v_pt record;
  v_count int := 0;
  v_today_end timestamptz := date_trunc('day', now() at time zone 'Europe/Berlin') + interval '1 day' - interval '1 second';
  v_emoji_pool text[] := ARRAY['⛩️','🏛️','🛕','⚜️','🗿'];
  v_emoji text;
begin
  for d in select id, name, city_slug from public.city_districts order by id loop
    select * into v_pt from public.random_point_in_district_urban(d.id);
    if v_pt.lat is null then continue; end if;

    v_emoji := v_emoji_pool[1 + (abs(hashtext(d.name || to_char(now(), 'YYYY-MM-DD'))) % array_length(v_emoji_pool, 1))];

    insert into public.sanctuaries (district_id, name, lat, lng, emoji, xp_reward, valid_until, rotated_at)
    values (d.id, d.name, v_pt.lat, v_pt.lng, v_emoji, 5000, v_today_end, now())
    on conflict (district_id) do update set
      lat = excluded.lat,
      lng = excluded.lng,
      emoji = excluded.emoji,
      valid_until = excluded.valid_until,
      rotated_at = excluded.rotated_at,
      name = excluded.name;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Direkt ausführen, damit Spandau/Steglitz-Zehlendorf jetzt urban respawnen
SELECT public.rotate_sanctuaries();
