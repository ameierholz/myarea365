-- Resource-Nodes-Polish + Achievement-Hook im Claim-Flow
-- 1) tick_gather_marches: "Wächter" → "Begleiter" Wording-Fix
-- 2) claim_inbox_rewards: pflegt user_stats-Counter (holz/stein/gold/mana _total_collected, gold_peak)
--    → Resource-Achievements (holz_10k, gold_100k, crypto_magnate, ...) schalten automatisch frei.

-- 1) tick_gather_marches Wording-Fix (Body identisch zur Vorgänger-Version, nur 'Wächter' → 'Begleiter')
create or replace function public.tick_gather_marches()
returns integer
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_m public.gather_marches%rowtype;
  v_node public.resource_nodes%rowtype;
  v_yield_per_tick bigint;
  v_collected bigint;
  v_yield_mult numeric;
  v_guardian_name text;
  v_kind_label text;
  v_resource_label text;
  v_resource_emoji text;
  v_was_recalled boolean;
  v_duration_min int;
  v_distance_km numeric;
  v_title text; v_body text; v_reward jsonb;
begin
  update public.gather_marches set status = 'gathering'
   where status = 'marching' and v_now >= arrives_at;

  for v_m in select * from public.gather_marches where status = 'gathering' loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;
    if not found then continue; end if;

    select coalesce(yield_mult, 1.0) into v_yield_mult
      from public.thief_bonus_for(v_m.guardian_id, v_node.kind);

    v_yield_per_tick := greatest(1, (v_node.total_yield / extract(epoch from (v_m.finishes_at - v_m.arrives_at)) * 60)::bigint);
    v_collected := least(
      ((v_node.current_yield + v_m.collected) * v_yield_mult)::bigint,
      ((v_node.total_yield * extract(epoch from (v_now - v_m.arrives_at)) / extract(epoch from (v_m.finishes_at - v_m.arrives_at))) * v_yield_mult)::bigint
    );

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
      select coalesce(ga.name, 'Begleiter') into v_guardian_name
        from public.user_guardians ug
        left join public.guardian_archetypes ga on ga.id = ug.archetype_id
       where ug.id = v_m.guardian_id;
    end if;

    v_kind_label := case coalesce(v_node.kind,'')
      when 'scrapyard' then 'Schrottplatz' when 'factory' then 'Fabrik'
      when 'atm' then 'Bank/ATM' when 'datacenter' then 'Datacenter' else 'Sammelpunkt' end;
    v_resource_label := case coalesce(v_node.resource_type,'')
      when 'wood' then 'Tech-Schrott' when 'stone' then 'Komponenten'
      when 'gold' then 'Krypto' when 'mana' then 'Bandbreite' else 'Resource' end;
    v_resource_emoji := case coalesce(v_node.resource_type,'')
      when 'wood' then '⚙️' when 'stone' then '🔩'
      when 'gold' then '💸' when 'mana' then '📡' else '📦' end;

    v_was_recalled := v_m.recall_progress is not null;
    v_duration_min := greatest(1, (extract(epoch from (v_now - v_m.started_at))::int / 60));
    v_distance_km := case when v_m.route_distance_m is not null
                          then round((v_m.route_distance_m / 1000.0)::numeric, 2) else null end;

    if v_was_recalled and coalesce(v_m.collected, 0) = 0 then
      v_title := '↩️ Plünderzug abgebrochen: ' || coalesce(v_node.name, v_kind_label);
      v_body  := 'Du hast deine ' || v_m.troop_count::text || ' Banditen vor Ankunft am '
              || v_kind_label || ' (Lv ' || coalesce(v_node.level::text,'?') || ') zurückgerufen.' || E'\n\n'
              || coalesce('Anführer: ' || v_guardian_name || E'\n','')
              || 'Marschdauer: ' || v_duration_min::text || ' min'
              || coalesce(E'\nStrecke: ' || v_distance_km::text || ' km','')
              || E'\n\nKeine Beute — die Truppen sind unbeschadet zu Hause.';
      v_reward := null;
    elsif v_was_recalled then
      v_title := '↩️ Plünderzug abgebrochen: ' || coalesce(v_node.name, v_kind_label);
      v_body  := 'Du hast deinen Plünderzug vorzeitig zurückgerufen.' || E'\n\n'
              || 'Trupp: ' || v_m.troop_count::text || ' Banditen' || E'\n'
              || coalesce('Anführer: ' || v_guardian_name || E'\n','')
              || 'Ziel: ' || v_kind_label || ' (Lv ' || coalesce(v_node.level::text,'?') || ')' || E'\n'
              || 'Marschdauer: ' || v_duration_min::text || ' min'
              || coalesce(E'\nStrecke: ' || v_distance_km::text || ' km','') || E'\n\n'
              || v_resource_emoji || ' Beute: ' || coalesce(v_m.collected::text,'0') || ' ' || v_resource_label;
      v_reward := jsonb_build_object('kind','resources', v_node.resource_type, v_m.collected);
    else
      v_title := v_resource_emoji || ' Plünderzug zurück: +' || coalesce(v_m.collected::text,'0') || ' ' || v_resource_label;
      v_body  := 'Deine ' || v_m.troop_count::text || ' Banditen sind erfolgreich vom '
              || v_kind_label || ' (Lv ' || coalesce(v_node.level::text,'?') || ') zurück.' || E'\n\n'
              || coalesce('Anführer: ' || v_guardian_name || E'\n','')
              || 'Marschdauer: ' || v_duration_min::text || ' min'
              || coalesce(E'\nStrecke: ' || v_distance_km::text || ' km','') || E'\n\n'
              || v_resource_emoji || ' Beute: ' || coalesce(v_m.collected::text,'0') || ' ' || v_resource_label;
      v_reward := jsonb_build_object('kind','resources', v_node.resource_type, v_m.collected);
    end if;

    insert into public.user_inbox (user_id, category, subcategory, kind, title, body, payload, reward_payload)
    values (v_m.user_id, 'report', 'gather',
      case when v_was_recalled then 'gather_recalled' else 'gather_complete' end,
      v_title, v_body,
      jsonb_build_object('march_id', v_m.id, 'node_id', v_m.node_id,
        'node_name', coalesce(v_node.name, v_kind_label), 'node_level', v_node.level,
        'kind', v_node.kind, 'resource_type', v_node.resource_type,
        'troop_count', v_m.troop_count, 'guardian_name', v_guardian_name,
        'collected', v_m.collected,
        'duration_seconds', extract(epoch from (v_now - v_m.started_at))::int,
        'route_distance_m', v_m.route_distance_m, 'was_recalled', v_was_recalled),
      v_reward);

    update public.gather_marches set status='completed', completed_at=v_now where id=v_m.id;
    v_count := v_count + 1;
  end loop;

  update public.resource_nodes set current_yield=total_yield, depleted_at=null, respawn_at=null
   where depleted_at is not null and respawn_at is not null and v_now >= respawn_at;

  return v_count;
end $$;

-- 2) claim_inbox_rewards: zählt user_stats hoch (Achievements freischalten)
create or replace function public.claim_inbox_rewards(p_ids uuid[] default null)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_total_w int := 0; v_total_s int := 0; v_total_g int := 0; v_total_m int := 0; v_total_t int := 0;
  v_n int := 0;
  r record;
  v_w int; v_s int; v_g int; v_mn int; v_t int;
  v_new_gold bigint;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  for r in
    select id, reward_payload from public.user_inbox
     where user_id = v_user and deleted_at is null
       and reward_payload is not null and claimed_at is null
       and (p_ids is null or id = any(p_ids))
  loop
    v_w  := coalesce((r.reward_payload->>'wood')::int, 0);
    v_s  := coalesce((r.reward_payload->>'stone')::int, 0);
    v_g  := coalesce((r.reward_payload->>'gold')::int, 0);
    v_mn := coalesce((r.reward_payload->>'mana')::int, 0);
    v_t  := coalesce((r.reward_payload->>'speed_tokens')::int, 0);

    if (v_w + v_s + v_g + v_mn + v_t) > 0 then
      insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
      values (v_user, v_w, v_s, v_g, v_mn, v_t)
      on conflict (user_id) do update set
        wood = public.user_resources.wood + excluded.wood,
        stone = public.user_resources.stone + excluded.stone,
        gold = public.user_resources.gold + excluded.gold,
        mana = public.user_resources.mana + excluded.mana,
        speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
        updated_at = now();
    end if;

    update public.user_inbox set claimed_at=now(), read_at=coalesce(read_at,now()) where id=r.id;
    v_total_w := v_total_w + v_w; v_total_s := v_total_s + v_s;
    v_total_g := v_total_g + v_g; v_total_m := v_total_m + v_mn;
    v_total_t := v_total_t + v_t; v_n := v_n + 1;
  end loop;

  -- Stats-Counter (Achievements)
  if v_total_w > 0 then perform public.stat_increment(v_user, 'holz_total_collected',  v_total_w); end if;
  if v_total_s > 0 then perform public.stat_increment(v_user, 'stein_total_collected', v_total_s); end if;
  if v_total_g > 0 then perform public.stat_increment(v_user, 'gold_total_collected',  v_total_g); end if;
  if v_total_m > 0 then perform public.stat_increment(v_user, 'mana_total_collected',  v_total_m); end if;

  if v_total_g > 0 then
    select gold into v_new_gold from public.user_resources where user_id=v_user;
    if v_new_gold is not null then
      perform public.stat_set_max(v_user, 'gold_peak', v_new_gold);
    end if;
  end if;

  return jsonb_build_object('ok', true,
    'claimed_count', v_n,
    'wood', v_total_w, 'stone', v_total_s,
    'gold', v_total_g, 'mana', v_total_m,
    'speed_tokens', v_total_t);
end $$;
