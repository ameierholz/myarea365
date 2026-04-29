-- ════════════════════════════════════════════════════════════════════
-- Repeater-Meta in get_repeater_turf_info ergänzen
-- ════════════════════════════════════════════════════════════════════
-- Zusatzfelder für das Repeater-Modal:
--   created_at            -- Bauzeitpunkt
--   founder_name          -- wer hat ihn errichtet
--   last_attack_at        -- letzter Angriff (resolved_at oder created_at)
--   last_attacker_crew    -- Name der Angreifer-Crew
--   ansehen_total         -- Summe Ansehen-Beitrag (alle Logs mit ref_id = repeater_id)
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
begin
  select id, lat, lng, kind, created_at, founder_user_id
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   into v_rep;
  if v_rep is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- Founder-Name
  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Unbekannt') into v_founder_name
    from public.users where id = v_rep.founder_user_id;

  -- Letzter Angriff (auch laufend marching → wir nehmen das jüngste Eintragsdatum)
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

  -- Ansehen-Beitrag: Summe aller Log-Deltas, deren ref_id auf diesen Repeater zeigt
  select coalesce(sum(delta), 0) into v_ansehen_total
    from public.ansehen_log where ref_id = p_repeater_id;

  -- Turf-Geometrie
  v_nb_id := public._neighborhood_id_at(v_rep.lat, v_rep.lng);

  if v_nb_id is null then
    declare v_radius int := public._repeater_turf_radius_for_kind(v_rep.kind);
    begin v_area_m2 := pi() * v_radius * v_radius; end;
    return jsonb_build_object(
      'ok', true,
      'fallback_circle', true,
      'area_m2', round(v_area_m2)::int,
      'boundary_streets', '[]'::jsonb,
      'created_at', v_rep.created_at,
      'founder_name', v_founder_name,
      'last_attack_at', coalesce(v_last_attack.resolved_at, v_last_attack.created_at),
      'last_attacker_crew', v_last_attacker_crew,
      'last_attack_outcome', v_last_attack.outcome,
      'last_attack_status', v_last_attack.status,
      'ansehen_total', v_ansehen_total
    );
  end if;

  select geom, area_m2 into v_geom, v_area_m2
    from public.neighborhood_blocks where id = v_nb_id;

  select array_agg(distinct ow.name order by ow.name) into v_streets
    from public._etl_osm_ways ow
   where ow.name is not null
     and ow.name <> ''
     and ow.highway in ('motorway','trunk','primary','secondary','tertiary',
                        'residential','unclassified')
     and ST_DWithin(ow.geom::geography, ST_Boundary(v_geom)::geography, 5);

  return jsonb_build_object(
    'ok', true,
    'fallback_circle', false,
    'area_m2', round(v_area_m2)::int,
    'boundary_streets', coalesce(to_jsonb(v_streets), '[]'::jsonb),
    'created_at', v_rep.created_at,
    'founder_name', v_founder_name,
    'last_attack_at', coalesce(v_last_attack.resolved_at, v_last_attack.created_at),
    'last_attacker_crew', v_last_attacker_crew,
    'last_attack_outcome', v_last_attack.outcome,
    'last_attack_status', v_last_attack.status,
    'ansehen_total', v_ansehen_total
  );
end $$;
grant execute on function public.get_repeater_turf_info(uuid) to authenticated;
