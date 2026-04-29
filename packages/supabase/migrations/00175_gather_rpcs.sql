-- ══════════════════════════════════════════════════════════════════════════
-- RPCs für Resource-Node-Sammeln + Gather-March-Lifecycle
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Sammel-Marsch starten ────────────────────────────────────────────
-- Berechnet Gehzeit (5 km/h Lauf-Speed pro march), Sammelzeit (level-abhängig)
create or replace function public.start_gather_march(
  p_node_id     bigint,
  p_guardian_id uuid,
  p_troop_count int,
  p_user_lat    double precision,
  p_user_lng    double precision
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_node    public.resource_nodes%rowtype;
  v_dist_m  double precision;
  v_walk_s  int;
  v_gather_s int;
  v_arrives timestamptz;
  v_finishes timestamptz;
  v_returns timestamptz;
  v_march_id bigint;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  -- Distanz User → Node (Haversine)
  v_dist_m := st_distance(
    st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
    v_node.geom::geography
  );

  -- Gehzeit: 5 km/h = ~1.39 m/s → walk_s = dist / 1.39
  v_walk_s := greatest(60, (v_dist_m / 1.39)::int);
  -- Sammelzeit: 5 min pro 1000 Yield, geteilt durch troop_count/100 (mehr Truppen = schneller)
  v_gather_s := greatest(60, (v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::int);

  v_arrives  := now() + (v_walk_s    || ' seconds')::interval;
  v_finishes := v_arrives + (v_gather_s || ' seconds')::interval;
  v_returns  := v_finishes + (v_walk_s || ' seconds')::interval;

  insert into public.gather_marches (user_id, node_id, guardian_id, troop_count, started_at, arrives_at, finishes_at, returns_at, status)
  values (v_user_id, p_node_id, p_guardian_id, p_troop_count, now(), v_arrives, v_finishes, v_returns, 'marching')
  returning id into v_march_id;

  return jsonb_build_object(
    'ok', true, 'march_id', v_march_id,
    'arrives_at', v_arrives, 'finishes_at', v_finishes, 'returns_at', v_returns,
    'walk_seconds', v_walk_s, 'gather_seconds', v_gather_s
  );
end $$;

-- ── 2. Gather-March-Tick: läuft per Cron alle 60s, advanciert Status ──
create or replace function public.tick_gather_marches() returns int language plpgsql security definer as $$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_m public.gather_marches%rowtype;
  v_node public.resource_nodes%rowtype;
  v_yield_per_tick bigint;
  v_collected bigint;
begin
  -- marching → gathering (Truppen sind angekommen)
  update public.gather_marches set status = 'gathering'
   where status = 'marching' and v_now >= arrives_at;

  -- gathering: Yield abziehen anteilig zur verstrichenen Zeit
  for v_m in select * from public.gather_marches where status = 'gathering' loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;
    if not found then continue; end if;

    -- Yield pro Sekunde basierend auf Gesamt-Sammelzeit
    v_yield_per_tick := greatest(1, (v_node.total_yield / extract(epoch from (v_m.finishes_at - v_m.arrives_at)) * 60)::bigint);

    -- Wieviel sollte JETZT gesammelt sein (linear über Sammeldauer)
    v_collected := least(v_node.current_yield + v_m.collected,
                         (v_node.total_yield * extract(epoch from (v_now - v_m.arrives_at)) / extract(epoch from (v_m.finishes_at - v_m.arrives_at)))::bigint);

    update public.gather_marches set collected = v_collected where id = v_m.id;

    -- Node-Pool reduzieren proportional
    update public.resource_nodes
       set current_yield = greatest(0, current_yield - v_yield_per_tick),
           depleted_at = case when current_yield - v_yield_per_tick <= 0 then v_now else null end,
           respawn_at  = case when current_yield - v_yield_per_tick <= 0 then v_now + interval '36 hours' else null end
     where id = v_m.node_id;

    v_count := v_count + 1;
  end loop;

  -- gathering → returning wenn Zeit um oder Node leer
  update public.gather_marches m set status = 'returning'
   where status = 'gathering'
     and (v_now >= finishes_at or exists (select 1 from public.resource_nodes n where n.id = m.node_id and n.depleted_at is not null));

  -- returning → completed wenn Truppen zurück sind, Resourcen ausschütten
  for v_m in select * from public.gather_marches where status = 'returning' and v_now >= returns_at loop
    -- Gesammelte Resource an User-Base auszahlen (über existierende base-resources Tabelle)
    -- Hier nur als Stub, die echte Auszahlung über RPC update_base_resource oder direkt UPDATE
    -- TODO: integriere in bestehendes base-resources-System
    update public.gather_marches set status = 'completed', completed_at = v_now where id = v_m.id;
    v_count := v_count + 1;
  end loop;

  -- Respawn: Knoten die ihren respawn_at überschritten haben → neue volle Yield
  update public.resource_nodes
     set current_yield = total_yield, depleted_at = null, respawn_at = null
   where depleted_at is not null and respawn_at is not null and v_now >= respawn_at;

  return v_count;
end $$;

revoke all on function public.start_gather_march(bigint, uuid, int, double precision, double precision) from public;
grant execute on function public.start_gather_march(bigint, uuid, int, double precision, double precision) to authenticated;
revoke all on function public.tick_gather_marches() from public;
grant execute on function public.tick_gather_marches() to service_role;
