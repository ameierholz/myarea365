-- ══════════════════════════════════════════════════════════════════════════
-- Sofort-Training (Gems) für Truppen — wie "SOFORT"-Button in Call of Dragons
-- ══════════════════════════════════════════════════════════════════════════
-- Formel: 1 Gem pro Minute Trainings-Zeit, gerundet auf nächste Minute.
-- Resourcen werden trotzdem normal abgezogen — Gems sparen nur Zeit.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.instant_train_troop(
  p_troop_id text,
  p_count    int,
  p_for_crew uuid default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_train jsonb;
  v_seconds int;
  v_gem_cost int;
  v_gems_have int;
  v_queue_id uuid;
begin
  if v_user is null then return jsonb_build_object('error','unauthenticated'); end if;

  -- 1) Normales Training starten (zieht Resourcen ab + legt Queue-Eintrag an)
  v_train := public.train_troop(p_troop_id, p_count, p_for_crew);
  if not coalesce((v_train->>'ok')::boolean, false) then return v_train; end if;
  v_seconds := coalesce((v_train->>'training_seconds')::int, 0);
  -- queue_id nachträglich holen (jüngste unfinished Queue für User/Troop)
  if p_for_crew is null then
    select id into v_queue_id from public.troop_training_queue
     where user_id = v_user and troop_id = p_troop_id and finished = false
     order by ends_at desc limit 1;
  else
    select id into v_queue_id from public.troop_training_queue
     where crew_id = p_for_crew and troop_id = p_troop_id and finished = false
     order by ends_at desc limit 1;
  end if;

  -- 2) Gem-Kosten berechnen (1 Gem pro Minute, mind. 1)
  v_gem_cost := greatest(1, ceil(v_seconds / 60.0)::int);

  -- 3) Gems prüfen + abziehen
  select coalesce(gems, 0) into v_gems_have from public.user_gems where user_id = v_user for update;
  if v_gems_have is null then v_gems_have := 0; end if;
  if v_gems_have < v_gem_cost then
    return jsonb_build_object('error','not_enough_gems','required',v_gem_cost,'have',v_gems_have,'queue_id',v_queue_id);
  end if;
  insert into public.user_gems (user_id, gems) values (v_user, 0)
    on conflict (user_id) do nothing;
  update public.user_gems set gems = gems - v_gem_cost where user_id = v_user;

  -- 4) Queue-Eintrag sofort fertigstellen + auf user_troops gutschreiben
  if v_queue_id is not null then
    update public.troop_training_queue
       set ends_at = now(), finished = true
     where id = v_queue_id and user_id = v_user;
    insert into public.user_troops (user_id, troop_id, count)
      values (v_user, p_troop_id, p_count)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
  end if;

  return jsonb_build_object('ok', true, 'gem_cost', v_gem_cost, 'count', p_count,
                            'gems_remaining', v_gems_have - v_gem_cost);
end $$;
revoke all on function public.instant_train_troop(text, int, uuid) from public;
grant execute on function public.instant_train_troop(text, int, uuid) to authenticated;
