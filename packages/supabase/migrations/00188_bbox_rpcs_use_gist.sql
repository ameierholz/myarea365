-- ══════════════════════════════════════════════════════════════════════════
-- BBox-RPCs auf ST_MakeEnvelope umstellen → nutzt GiST-Index aus 00187
-- statt Range-Scan über lat/lng. Erwartung: <5ms statt seq scan bei vielen Rows.
-- Zusätzlich harte LIMITs gegen Memory-Blowup.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.get_bases_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns jsonb language plpgsql security definer as $$
declare
  v_envelope geometry := st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);
  v_runner jsonb; v_crew jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'runner',
    'id', b.id,
    'owner_user_id', b.owner_user_id,
    'owner_username', coalesce(u.display_name, 'Runner'),
    'lat', b.lat, 'lng', b.lng,
    'level', b.level,
    'theme_id', b.theme_id,
    'pin_label', coalesce(b.pin_label, u.display_name, 'Runner'),
    'crew_tag', oc.tag,
    'is_own', (b.owner_user_id = auth.uid())
  )), '[]'::jsonb) into v_runner
  from (
    select * from public.bases
     where geom is not null and geom && v_envelope
     limit 500
  ) b
  left join public.users u on u.id = b.owner_user_id
  left join public.crew_members om on om.user_id = b.owner_user_id
  left join public.crews oc on oc.id = om.crew_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'crew',
    'id', cb.id,
    'crew_id', cb.crew_id,
    'lat', cb.lat, 'lng', cb.lng,
    'level', cb.level,
    'theme_id', cb.theme_id,
    'pin_label', coalesce(cb.pin_label, c.name, 'Crew'),
    'crew_tag', c.tag,
    'is_own', exists (select 1 from public.crew_members m where m.crew_id = cb.crew_id and m.user_id = auth.uid())
  )), '[]'::jsonb) into v_crew
  from (
    select * from public.crew_bases
     where geom is not null and geom && v_envelope
     limit 500
  ) cb
  left join public.crews c on c.id = cb.crew_id;

  return jsonb_build_object('ok', true, 'runner', v_runner, 'crew', v_crew);
end $$;

-- ─── strongholds: ebenfalls auf GiST/ST_MakeEnvelope ────────────────────
-- API-Vertrag (lat/lng/radius_km) bleibt erhalten — wir bauen daraus die Envelope.
create or replace function public.get_nearby_strongholds(
  p_lat double precision, p_lng double precision, p_radius_km numeric default 15
) returns jsonb language plpgsql security definer as $$
declare
  v_dlat double precision := p_radius_km / 111.0;
  v_dlng double precision := p_radius_km / (111.0 * cos(radians(p_lat)));
  v_envelope geometry := st_makeenvelope(
    p_lng - v_dlng, p_lat - v_dlat,
    p_lng + v_dlng, p_lat + v_dlat,
    4326
  );
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'lat', lat, 'lng', lng,
      'plz', plz,
      'level', level,
      'total_hp', total_hp,
      'current_hp', current_hp,
      'hp_pct', case when total_hp > 0 then round(100.0 * current_hp / total_hp, 0) else 0 end,
      'respawn_at', respawn_at,
      'defeated_at', defeated_at
    ))
    from (
      select * from public.strongholds
       where defeated_at is null
         and geom is not null and geom && v_envelope
       limit 500
    ) s
  ), '[]'::jsonb);
end $$;
