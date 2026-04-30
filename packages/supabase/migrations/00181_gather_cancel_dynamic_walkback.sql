-- ══════════════════════════════════════════════════════════════════════════
-- Recall-Zeit dynamisch: wenn Banditen vor Ankunft zurückgerufen werden,
-- brauchen sie nur so lang zurück wie sie schon gelaufen sind.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.cancel_gather_march(p_march_id bigint)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_m public.gather_marches%rowtype;
  v_full_walk_seconds int;
  v_walked_seconds int;
  v_returns timestamptz;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_m from public.gather_marches where id = p_march_id;
  if not found then return jsonb_build_object('error','march_not_found'); end if;
  if v_m.user_id <> v_user_id then return jsonb_build_object('error','not_owner'); end if;
  if v_m.status not in ('marching','gathering') then
    return jsonb_build_object('error','not_active', 'status', v_m.status);
  end if;

  v_full_walk_seconds := greatest(60, extract(epoch from (v_m.arrives_at - v_m.started_at))::int);

  if v_m.status = 'marching' then
    -- Bei Recall vor Ankunft: nur bisher gelaufene Zeit als Rückweg
    v_walked_seconds := greatest(10, extract(epoch from (now() - v_m.started_at))::int);
    -- Cap auf volle Distanz (falls Tick verspätet, sicher ist sicher)
    if v_walked_seconds > v_full_walk_seconds then v_walked_seconds := v_full_walk_seconds; end if;
  else
    -- Bei Recall während Plünderns: voller Rückweg von Node zur Base
    v_walked_seconds := v_full_walk_seconds;
  end if;

  v_returns := now() + (v_walked_seconds || ' seconds')::interval;

  update public.gather_marches
     set status = 'returning',
         finishes_at = now(),
         returns_at  = v_returns
   where id = p_march_id;

  return jsonb_build_object('ok', true, 'march_id', p_march_id, 'returns_at', v_returns, 'return_seconds', v_walked_seconds);
end $$;

revoke all on function public.cancel_gather_march(bigint) from public;
grant execute on function public.cancel_gather_march(bigint) to authenticated;
