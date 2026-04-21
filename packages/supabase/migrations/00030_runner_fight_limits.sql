-- 00030: Kleinere Arena-Pools + neues Fight-Limit + Gem-Staffel
-- 4 Gegner pro Mischung (statt 10)
-- 5 Gratis-Fights + 10 Kauf-Fights = 15 Tages-Limit (statt 10 + 20 = 30)

-- ─── Neue Preis-Staffel ───────────────────────────────────────────
-- 1–5 gratis, 6–7: 50💎, 8–10: 100💎, 11–13: 200💎, 14–15: 400💎, >15 gesperrt
create or replace function public.runner_fight_next_gem_cost(p_used int)
returns int language sql immutable as $$
  select case
    when p_used < 5  then 0
    when p_used < 7  then 50
    when p_used < 10 then 100
    when p_used < 13 then 200
    when p_used < 15 then 400
    else -1  -- gesperrt
  end;
$$;

-- ─── Matchmaking: nur 4 Gegner ─────────────────────────────────────
create or replace function public.runner_fight_get_opponents(p_user_id uuid, p_force_refresh boolean)
returns jsonb language plpgsql security definer as $$
declare
  v_cached jsonb;
  v_refresh_used int;
  v_level int;
  v_faction text;
  v_opponents jsonb;
  v_cost int;
begin
  perform public.runner_fight_reset_if_needed(p_user_id);
  select cached_opponents, refresh_used_today into v_cached, v_refresh_used
    from public.runner_fight_state where user_id = p_user_id;

  if v_cached is not null and not p_force_refresh then
    return jsonb_build_object('ok', true, 'opponents', v_cached, 'from_cache', true);
  end if;

  if p_force_refresh and v_refresh_used >= 1 then
    v_cost := 30;
    if not exists (select 1 from public.user_gems where user_id = p_user_id and gems >= v_cost) then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gems_for_refresh', 'cost', v_cost);
    end if;
    update public.user_gems set gems = gems - v_cost, total_spent = total_spent + v_cost, updated_at = now() where user_id = p_user_id;
  end if;

  select ug.level into v_level
    from public.user_guardians ug
    where ug.user_id = p_user_id and ug.is_active
    limit 1;
  if v_level is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_guardian');
  end if;

  select u.faction into v_faction from public.users u where u.id = p_user_id;

  -- 4 Gegner: aktive Wächter in ±3 Level
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_opponents from (
    select ug.id as guardian_id, ug.user_id, ug.archetype_id, ug.level,
           ug.wins, ug.losses, ug.current_hp_pct,
           u.username, u.display_name, u.faction, u.avatar_url,
           ga.name as archetype_name, ga.emoji as archetype_emoji,
           ga.rarity, ga.guardian_type, ga.role
      from public.user_guardians ug
      join public.users u on u.id = ug.user_id
      join public.guardian_archetypes ga on ga.id = ug.archetype_id
     where ug.is_active
       and ug.user_id <> p_user_id
       and ug.level between greatest(1, v_level - 3) and v_level + 3
     order by random()
     limit 4
  ) t;

  update public.runner_fight_state
     set cached_opponents = v_opponents,
         refresh_used_today = refresh_used_today + (case when p_force_refresh then 1 else 0 end),
         last_refresh_at = now(),
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'opponents', v_opponents, 'from_cache', false);
end $$;
