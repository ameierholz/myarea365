-- ══════════════════════════════════════════════════════════════════════════
-- Sammel-Marsch: Recall (Zurückrufen) + Node-Sammel-Indikator
-- ══════════════════════════════════════════════════════════════════════════

-- ── Recall: aktiven Marsch sofort in 'returning' versetzen ──────────────
-- Truppen laufen mit dem bisher gesammelten Yield zurück. Die verbleibende
-- Rück-Geh-Zeit wird auf Basis der ursprünglichen Walk-Time berechnet.
create or replace function public.cancel_gather_march(p_march_id bigint)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_m public.gather_marches%rowtype;
  v_walk_seconds int;
  v_returns timestamptz;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_m from public.gather_marches where id = p_march_id;
  if not found then return jsonb_build_object('error','march_not_found'); end if;
  if v_m.user_id <> v_user_id then return jsonb_build_object('error','not_owner'); end if;
  if v_m.status not in ('marching','gathering') then
    return jsonb_build_object('error','not_active', 'status', v_m.status);
  end if;

  -- Original-Walk-Sekunden = arrives_at - started_at
  v_walk_seconds := greatest(60, extract(epoch from (v_m.arrives_at - v_m.started_at))::int);
  v_returns := now() + (v_walk_seconds || ' seconds')::interval;

  update public.gather_marches
     set status = 'returning',
         finishes_at = now(),     -- Sammeln stoppen (auch wenn 'marching')
         returns_at  = v_returns
   where id = p_march_id;

  return jsonb_build_object('ok', true, 'march_id', p_march_id, 'returns_at', v_returns);
end $$;

revoke all on function public.cancel_gather_march(bigint) from public;
grant execute on function public.cancel_gather_march(bigint) to authenticated;

-- ── View: aktive Sammel-Aktionen pro Node (für Indikator + Countdown) ──
-- Liefert je Node die Anzahl Sammler + Soonest-Finish + ob eigener User mit dabei.
create or replace view public.resource_node_active_gathers as
  select
    n.id as node_id,
    count(*) filter (where m.status in ('marching','gathering')) as active_count,
    bool_or(m.status = 'gathering') as someone_gathering,
    min(m.finishes_at) filter (where m.status = 'gathering') as next_finish_at,
    array_agg(distinct m.user_id) filter (where m.status in ('marching','gathering')) as user_ids
  from public.resource_nodes n
  left join public.gather_marches m on m.node_id = n.id
  where m.status in ('marching','gathering')
  group by n.id;

grant select on public.resource_node_active_gathers to authenticated, anon;
