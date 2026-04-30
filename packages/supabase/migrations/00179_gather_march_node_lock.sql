-- ══════════════════════════════════════════════════════════════════════════
-- Sammel-Marsch: Node-Lock — pro Resource-Node nur EIN aktiver Marsch
-- gleichzeitig (egal welcher User). Zweiter Versuch wird abgelehnt.
-- ══════════════════════════════════════════════════════════════════════════

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
  v_busy_user uuid;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  -- Node-Lock: pro Node nur ein aktiver Marsch
  select user_id into v_busy_user
    from public.gather_marches
   where node_id = p_node_id and status in ('marching','gathering')
   limit 1;
  if v_busy_user is not null then
    return jsonb_build_object(
      'error','node_busy',
      'message','Dieser Sammelpunkt wird bereits ausgebeutet — warte bis der aktive Marsch fertig ist.',
      'mine', v_busy_user = v_user_id
    );
  end if;

  v_dist_m := st_distance(
    st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
    v_node.geom::geography
  );

  v_walk_s   := greatest(60, (v_dist_m / 1.39)::int);
  v_gather_s := greatest(60, (v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::int);

  v_arrives  := now() + (v_walk_s    || ' seconds')::interval;
  v_finishes := v_arrives + (v_gather_s || ' seconds')::interval;
  v_returns  := v_finishes + (v_walk_s || ' seconds')::interval;

  insert into public.gather_marches (user_id, node_id, guardian_id, troop_count, started_at, arrives_at, finishes_at, returns_at, status, origin_lat, origin_lng)
  values (v_user_id, p_node_id, p_guardian_id, p_troop_count, now(), v_arrives, v_finishes, v_returns, 'marching', p_user_lat, p_user_lng)
  returning id into v_march_id;

  return jsonb_build_object(
    'ok', true, 'march_id', v_march_id,
    'arrives_at', v_arrives, 'finishes_at', v_finishes, 'returns_at', v_returns,
    'walk_seconds', v_walk_s, 'gather_seconds', v_gather_s
  );
end $$;

grant execute on function public.start_gather_march(bigint, uuid, int, double precision, double precision) to authenticated;
