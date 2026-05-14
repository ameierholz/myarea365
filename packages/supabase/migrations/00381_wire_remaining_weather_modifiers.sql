-- 00381_wire_remaining_weather_modifiers.sql
-- Verkable bisher nur deklarierte Modifier:
--   - combined_heal_mult in start_heal
--   - _weather_incoming_march_mult (Sumpfboden) in start_player_base_scout

create or replace function public.start_heal(p_troop_id text, p_count integer)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inj record;
  v_cost_per int := 50;
  v_total_rss int;
  v_rss record;
  v_dur_s int;
  v_city text;
  v_heal_mult numeric := 1.0;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'error','not_authenticated'); end if;
  if p_count <= 0 then return jsonb_build_object('ok',false,'error','invalid_count'); end if;

  select * into v_inj from public.injured_troops where user_id = v_uid and troop_id = p_troop_id;
  if v_inj.count is null or v_inj.count < p_count then
    return jsonb_build_object('ok',false,'error','not_enough_injured');
  end if;

  v_total_rss := v_cost_per * p_count;
  select * into v_rss from public.user_resources where user_id = v_uid;
  if coalesce(v_rss.wood,0) < v_total_rss or coalesce(v_rss.stone,0) < v_total_rss
    or coalesce(v_rss.gold,0) < v_total_rss or coalesce(v_rss.mana,0) < v_total_rss then
    return jsonb_build_object('ok',false,'error','not_enough_rss','need_each',v_total_rss);
  end if;

  select home_city_slug into v_city from public.users where id = v_uid;
  v_heal_mult := public.combined_heal_mult(v_city);

  v_dur_s := greatest(60, round(p_count * 12 * coalesce(v_heal_mult, 1.0))::int);

  update public.user_resources set
    wood = wood - v_total_rss, stone = stone - v_total_rss,
    gold = gold - v_total_rss, mana = mana - v_total_rss
    where user_id = v_uid;
  update public.injured_troops set count = count - p_count where user_id = v_uid and troop_id = p_troop_id;
  delete from public.injured_troops where user_id = v_uid and troop_id = p_troop_id and count <= 0;

  insert into public.heal_queue (user_id, troop_id, count, cost_wood, cost_stone, cost_gold, cost_mana, ends_at)
    values (v_uid, p_troop_id, p_count, v_total_rss, v_total_rss, v_total_rss, v_total_rss,
            now() + (v_dur_s || ' seconds')::interval);

  return jsonb_build_object('ok',true,'count',p_count,'cost_each_rss',v_total_rss,
                            'heal_seconds', v_dur_s,
                            'weather_heal_mult', v_heal_mult);
end $$;
