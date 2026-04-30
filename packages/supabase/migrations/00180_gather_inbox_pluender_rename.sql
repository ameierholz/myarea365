-- ══════════════════════════════════════════════════════════════════════════
-- Inbox-Report umbenennen: Sammeln → Plündern (Berlin-Cyberpunk-Setting)
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.tick_gather_marches() returns int language plpgsql security definer as $$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_m public.gather_marches%rowtype;
  v_node public.resource_nodes%rowtype;
  v_yield_per_tick bigint;
  v_collected bigint;
  v_guardian_name text;
  v_kind_label text;
  v_resource_label text;
begin
  update public.gather_marches set status = 'gathering'
   where status = 'marching' and v_now >= arrives_at;

  for v_m in select * from public.gather_marches where status = 'gathering' loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;
    if not found then continue; end if;

    v_yield_per_tick := greatest(1, (v_node.total_yield / extract(epoch from (v_m.finishes_at - v_m.arrives_at)) * 60)::bigint);
    v_collected := least(v_node.current_yield + v_m.collected,
                         (v_node.total_yield * extract(epoch from (v_now - v_m.arrives_at)) / extract(epoch from (v_m.finishes_at - v_m.arrives_at)))::bigint);
    update public.gather_marches set collected = v_collected where id = v_m.id;

    update public.resource_nodes
       set current_yield = greatest(0, current_yield - v_yield_per_tick),
           depleted_at = case when current_yield - v_yield_per_tick <= 0 then v_now else null end,
           respawn_at  = case when current_yield - v_yield_per_tick <= 0 then v_now + interval '36 hours' else null end
     where id = v_m.node_id;

    v_count := v_count + 1;
  end loop;

  update public.gather_marches m set status = 'returning'
   where status = 'gathering'
     and (v_now >= finishes_at or exists (select 1 from public.resource_nodes n where n.id = m.node_id and n.depleted_at is not null));

  for v_m in select * from public.gather_marches where status = 'returning' and v_now >= returns_at loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;

    v_guardian_name := null;
    if v_m.guardian_id is not null then
      select coalesce(ga.name, 'Wächter') into v_guardian_name
        from public.user_guardians ug
        left join public.guardian_archetypes ga on ga.id = ug.archetype_id
       where ug.id = v_m.guardian_id;
    end if;

    v_kind_label := case coalesce(v_node.kind, '')
      when 'scrapyard'  then 'Schrottplatz'
      when 'factory'    then 'Fabrik'
      when 'atm'        then 'Bank/ATM'
      when 'datacenter' then 'Datacenter'
      else 'Plünderziel' end;
    v_resource_label := case coalesce(v_node.resource_type, '')
      when 'wood'  then 'Tech-Schrott'
      when 'stone' then 'Komponenten'
      when 'gold'  then 'Krypto'
      when 'mana'  then 'Bandbreite'
      else 'Resource' end;

    insert into public.user_inbox (user_id, category, subcategory, kind, title, body, payload, reward_payload)
    values (
      v_m.user_id,
      'report', 'gather', 'gather_complete',
      'Plünderzug zurück: ' || coalesce(v_node.name, v_kind_label),
      'Deine ' || v_m.troop_count::text || ' Banditen sind vom ' || v_kind_label ||
      ' (Lv ' || coalesce(v_node.level::text, '?') || ') zurück. ' ||
      coalesce('Geführt von ' || v_guardian_name || '. ', '') ||
      'Beute: ' || coalesce(v_m.collected::text, '0') || ' ' || v_resource_label || '.',
      jsonb_build_object(
        'march_id', v_m.id,
        'node_id', v_m.node_id,
        'node_name', coalesce(v_node.name, v_kind_label),
        'node_level', v_node.level,
        'kind', v_node.kind,
        'resource_type', v_node.resource_type,
        'troop_count', v_m.troop_count,
        'guardian_name', v_guardian_name,
        'collected', v_m.collected,
        'duration_seconds', extract(epoch from (v_now - v_m.started_at))::int
      ),
      jsonb_build_object(
        'kind', 'resources',
        v_node.resource_type, v_m.collected
      )
    );

    update public.gather_marches set status = 'completed', completed_at = v_now where id = v_m.id;
    v_count := v_count + 1;
  end loop;

  update public.resource_nodes
     set current_yield = total_yield, depleted_at = null, respawn_at = null
   where depleted_at is not null and respawn_at is not null and v_now >= respawn_at;

  return v_count;
end $$;

revoke all on function public.tick_gather_marches() from public;
grant execute on function public.tick_gather_marches() to service_role;
