-- ════════════════════════════════════════════════════════════════════
-- Repeater-Modal: same_turf_repeaters + adjacent_crews
-- ════════════════════════════════════════════════════════════════════
-- Zwei zusätzliche Felder:
--   same_turf_repeaters: andere Repeater (eigene Crew) im selben Kiez
--   adjacent_crews:      fremde Crews mit Repeatern in angrenzenden Kiezen
-- ════════════════════════════════════════════════════════════════════

create or replace function public.get_repeater_turf_info(p_repeater_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_rep record;
  v_nb_id bigint;
  v_area_m2 double precision;
  v_streets text[];
  v_geom geometry;
  v_founder_name text;
  v_last_attack record;
  v_last_attacker_crew text;
  v_ansehen_total bigint;
  v_same_turf jsonb;
  v_adjacent jsonb;
begin
  select id, lat, lng, kind, created_at, founder_user_id, crew_id
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   into v_rep;
  if v_rep is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Unbekannt') into v_founder_name
    from public.users where id = v_rep.founder_user_id;

  select created_at, resolved_at, attacker_crew_id, status, outcome, hp_damage
    into v_last_attack
    from public.crew_repeater_attacks
   where repeater_id = p_repeater_id
   order by coalesce(resolved_at, created_at) desc
   limit 1;

  if v_last_attack.attacker_crew_id is not null then
    select coalesce(name, 'Unbekannte Crew') into v_last_attacker_crew
      from public.crews where id = v_last_attack.attacker_crew_id;
  end if;

  select coalesce(sum(delta), 0) into v_ansehen_total
    from public.ansehen_log where ref_id = p_repeater_id;

  v_nb_id := public._neighborhood_id_at(v_rep.lat, v_rep.lng);

  if v_nb_id is not null then
    select geom, area_m2 into v_geom, v_area_m2
      from public.neighborhood_blocks where id = v_nb_id;

    -- Andere Repeater im selben Kiez (eigene Crew)
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', cr.id,
      'kind', cr.kind,
      'label', cr.label,
      'hp', cr.hp,
      'max_hp', cr.max_hp
    ) order by cr.kind), '[]'::jsonb) into v_same_turf
    from public.crew_repeaters cr
    where cr.id <> v_rep.id
      and cr.crew_id = v_rep.crew_id
      and cr.destroyed_at is null
      and public._neighborhood_id_at(cr.lat, cr.lng) = v_nb_id;

    -- Anrainer-Crews: fremde Crews mit Repeatern in angrenzenden Kiezen
    -- (Kieze die das eigene Polygon berühren, dann distinct fremde Crews darin)
    select coalesce(jsonb_agg(distinct jsonb_build_object(
      'crew_id', c.id,
      'crew_name', coalesce(c.name, '—'),
      'crew_tag', upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
      'repeater_count', cnt.n
    )), '[]'::jsonb) into v_adjacent
    from (
      select cr2.crew_id, count(*)::int as n
      from public.neighborhood_blocks nb
      join public.crew_repeaters cr2
        on cr2.destroyed_at is null
       and public._neighborhood_id_at(cr2.lat, cr2.lng) = nb.id
      where nb.id <> v_nb_id
        and ST_DWithin(nb.geom::geography, v_geom::geography, 5)
        and cr2.crew_id <> v_rep.crew_id
      group by cr2.crew_id
    ) cnt
    join public.crews c on c.id = cnt.crew_id;

    select array_agg(distinct ow.name order by ow.name) into v_streets
      from public._etl_osm_ways ow
     where ow.name is not null
       and ow.name <> ''
       and ow.highway in ('motorway','trunk','primary','secondary','tertiary',
                          'residential','unclassified')
       and ST_DWithin(ow.geom::geography, ST_Boundary(v_geom)::geography, 5);
  else
    declare v_radius int := public._repeater_turf_radius_for_kind(v_rep.kind);
    begin v_area_m2 := pi() * v_radius * v_radius; end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'fallback_circle', v_nb_id is null,
    'area_m2', round(v_area_m2)::int,
    'boundary_streets', coalesce(to_jsonb(v_streets), '[]'::jsonb),
    'created_at', v_rep.created_at,
    'founder_name', v_founder_name,
    'last_attack_at', coalesce(v_last_attack.resolved_at, v_last_attack.created_at),
    'last_attacker_crew', v_last_attacker_crew,
    'last_attack_outcome', v_last_attack.outcome,
    'last_attack_status', v_last_attack.status,
    'ansehen_total', v_ansehen_total,
    'same_turf_repeaters', coalesce(v_same_turf, '[]'::jsonb),
    'adjacent_crews', coalesce(v_adjacent, '[]'::jsonb)
  );
end $$;
grant execute on function public.get_repeater_turf_info(uuid) to authenticated;
