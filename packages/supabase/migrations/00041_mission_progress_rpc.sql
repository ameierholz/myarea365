-- 00041: RPC für Missions-Fortschritt.
-- Wird aus API-Routen (Walk, Arena, Shop etc.) aufgerufen, um den Progress aller
-- aktiv zugewiesenen Missionen mit passendem target_metric zu erhöhen.

create or replace function public.bump_mission_progress(
  p_user_id uuid,
  p_metric text,
  p_amount numeric default 1
)
returns table(updated_count int, newly_completed int)
language plpgsql
security definer
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_monday date := v_today - extract(dow from v_today)::int + 1;
  v_updated int := 0;
  v_completed int := 0;
  r record;
begin
  if p_amount <= 0 then
    return query select 0, 0;
    return;
  end if;

  -- Alle heute/Woche aktiven Zuweisungen finden, deren Mission diese Metrik matcht
  for r in
    select um.id, um.progress, um.completed_at, m.target_value
    from public.user_missions um
    join public.missions m on m.id = um.mission_id
    where um.user_id = p_user_id
      and um.claimed_at is null
      and m.active = true
      and m.target_metric = p_metric
      and (um.assigned_for_date = v_today or (m.type = 'weekly' and um.assigned_for_date = v_monday))
  loop
    v_updated := v_updated + 1;
    declare
      v_new_progress numeric := coalesce(r.progress, 0) + p_amount;
      v_now timestamptz := now();
      v_was_done boolean := r.completed_at is not null;
      v_is_done boolean := v_new_progress >= r.target_value;
    begin
      update public.user_missions
      set progress = v_new_progress,
          completed_at = case when v_is_done and not v_was_done then v_now else completed_at end
      where id = r.id;

      if v_is_done and not v_was_done then
        v_completed := v_completed + 1;
      end if;
    end;
  end loop;

  return query select v_updated, v_completed;
end $$;

grant execute on function public.bump_mission_progress(uuid, text, numeric) to authenticated, service_role;

comment on function public.bump_mission_progress is
  'Erhöht den Progress aller aktiv zugewiesenen Missionen mit passendem target_metric um p_amount. Markiert completed_at, wenn target_value erreicht.';
