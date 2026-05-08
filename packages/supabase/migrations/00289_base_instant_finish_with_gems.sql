-- ════════════════════════════════════════════════════════════════════════
-- Sofort-Bau mit Diamanten (Gems)
-- ════════════════════════════════════════════════════════════════════════
-- Speed-Tokens bleiben für partielle Skips (5 min/Token), aber der dedicated
-- "SOFORT"-Button im Build-Detail-Modal nimmt jetzt Diamanten:
--   gems_cost = ceil(remaining_seconds / 60)   (1 Diamant pro Minute)
--
-- Atomar: lockt queue-row + user_gems, finalisiert wenn genug.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.instant_finish_queue_with_gems(p_queue_id uuid)
returns table (ok boolean, gems_used int, error text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_queue       public.building_queue%rowtype;
  v_base_owner  uuid;
  v_remaining_s int;
  v_cost        int;
  v_have        int;
begin
  if v_user is null then
    return query select false, 0, 'not_authenticated'::text;
    return;
  end if;

  -- Lock queue
  select * into v_queue from public.building_queue where id = p_queue_id for update;
  if not found then
    return query select false, 0, 'queue_not_found'::text;
    return;
  end if;
  if v_queue.finished then
    return query select false, 0, 'already_finished'::text;
    return;
  end if;

  -- Owner check via base
  select owner_user_id into v_base_owner from public.bases where id = v_queue.base_id;
  if v_base_owner is null or v_base_owner <> v_user then
    return query select false, 0, 'not_owner'::text;
    return;
  end if;

  -- Remaining seconds + Cost (1 Diamant pro angefangene Minute, mindestens 1)
  v_remaining_s := greatest(0, ceil(extract(epoch from (v_queue.ends_at - now())))::int);
  v_cost := greatest(1, ceil(v_remaining_s / 60.0)::int);

  -- Diamant-Saldo
  insert into public.user_gems (user_id, gems) values (v_user, 0) on conflict (user_id) do nothing;
  select coalesce(gems, 0) into v_have from public.user_gems where user_id = v_user for update;
  if v_have < v_cost then
    return query select false, v_cost, 'not_enough_gems'::text;
    return;
  end if;

  -- Diamanten abziehen
  update public.user_gems set
    gems        = gems - v_cost,
    total_spent = coalesce(total_spent, 0) + v_cost,
    updated_at  = now()
  where user_id = v_user;

  -- Queue finalisieren: ends_at = now() → finish_building macht den Rest
  update public.building_queue set ends_at = now() where id = p_queue_id;

  -- finish_building auto-finalisiert alle abgelaufenen Builds dieses Users
  perform public.finish_building();

  return query select true, v_cost, null::text;
end $$;

grant execute on function public.instant_finish_queue_with_gems(uuid) to authenticated;
