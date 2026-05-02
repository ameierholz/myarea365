-- ══════════════════════════════════════════════════════════════════════════
-- get_bases_in_bbox: liefert zusätzlich equipped_base_ring_id pro Runner-Pin,
-- damit die Karte den ausgewählten Base-Ring um das Badge rendern kann.
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
    'base_ring_id', coalesce(u.equipped_base_ring_id, 'default'),
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
