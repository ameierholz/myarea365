-- 00351_chest_drop_xp_pot_l.sql
-- consume_chest_with_key referenzierte noch die archivierte Vertrauens-
-- münze (elixir_20k, Mig 00348). Event/Legendary-Truhen droppen jetzt
-- xp_pot_l (Großes Erfahrung-Elixier) — funktional dasselbe (1000 EP
-- per Item) und konsistent zum aktuellen EP-System.

CREATE OR REPLACE FUNCTION public.consume_chest_with_key(p_chest_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
  v_user uuid := auth.uid();
  v_chest record;
  v_tier text;
  v_key_id text;
  v_key_count int;
  v_chest_count int;
  v_reward jsonb := '[]'::jsonb;
  v_silver_gold int := 5000;
  v_silver_speed_count int := 1;
  v_gold_gems int := 200;
  v_gold_speed_count int := 3;
  v_legendary_gems int := 1000;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select * into v_chest from public.inventory_item_catalog where id = p_chest_id;
  if v_chest.id is null or v_chest.category <> 'chest' then return jsonb_build_object('ok', false, 'error', 'not_a_chest'); end if;
  v_tier := coalesce(v_chest.payload->>'tier', '');

  select count into v_chest_count from public.user_inventory_items where user_id = v_user and item_id = p_chest_id;
  if coalesce(v_chest_count, 0) < 1 then return jsonb_build_object('ok', false, 'error', 'no_chest'); end if;

  if v_tier = 'silver' then v_key_id := 'key_silver';
  elsif v_tier = 'gold' then v_key_id := 'key_gold';
  elsif v_tier in ('event','legendary') then v_key_id := null;
  else v_key_id := null;
  end if;

  if v_key_id is not null then
    select count into v_key_count from public.user_inventory_items where user_id = v_user and item_id = v_key_id;
    if coalesce(v_key_count, 0) < 1 then
      return jsonb_build_object('ok', false, 'error', 'missing_key', 'required_key', v_key_id);
    end if;
    update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = v_key_id;
    delete from public.user_inventory_items where user_id = v_user and item_id = v_key_id and count <= 0;
  end if;

  update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = p_chest_id;
  delete from public.user_inventory_items where user_id = v_user and item_id = p_chest_id and count <= 0;

  if v_tier = 'silver' then
    perform public.add_user_resources(v_user, v_silver_gold, v_silver_gold, v_silver_gold, 0, 0);
    perform public.grant_inventory_item(v_user, 'speedup_uni_15m', v_silver_speed_count);
    v_reward := jsonb_build_array(
      jsonb_build_object('kind','rss','wood',v_silver_gold,'stone',v_silver_gold,'gold',v_silver_gold),
      jsonb_build_object('kind','item','item_id','speedup_uni_15m','count',v_silver_speed_count));
  elsif v_tier = 'gold' then
    insert into public.user_gems (user_id, gems) values (v_user, v_gold_gems)
      on conflict (user_id) do update set gems = public.user_gems.gems + v_gold_gems;
    perform public.grant_inventory_item(v_user, 'speedup_uni_60m', v_gold_speed_count);
    perform public.grant_inventory_item(v_user, 'res_pack_normal', 1);
    v_reward := jsonb_build_array(
      jsonb_build_object('kind','gems','amount',v_gold_gems),
      jsonb_build_object('kind','item','item_id','speedup_uni_60m','count',v_gold_speed_count),
      jsonb_build_object('kind','item','item_id','res_pack_normal','count',1));
  elsif v_tier in ('event','legendary') then
    insert into public.user_gems (user_id, gems) values (v_user, v_legendary_gems)
      on conflict (user_id) do update set gems = public.user_gems.gems + v_legendary_gems;
    perform public.grant_inventory_item(v_user, 'speedup_build_8h', 1);
    perform public.grant_inventory_item(v_user, 'res_chest_choice_t2', 1);
    -- elixir_20k war Vertrauensmünze, archiviert in Mig 00348.
    -- Ersetzt durch xp_pot_l (Großes Erfahrung-Elixier, 1000 EP).
    insert into public.user_guardian_xp_items (user_id, item_id, count)
      values (v_user, 'xp_pot_l', 1)
      on conflict (user_id, item_id) do update set count = public.user_guardian_xp_items.count + 1, updated_at = now();
    v_reward := jsonb_build_array(
      jsonb_build_object('kind','gems','amount',v_legendary_gems),
      jsonb_build_object('kind','item','item_id','speedup_build_8h','count',1),
      jsonb_build_object('kind','item','item_id','res_chest_choice_t2','count',1),
      jsonb_build_object('kind','item','item_id','xp_pot_l','count',1));
  end if;

  return jsonb_build_object('ok', true, 'tier', v_tier, 'reward', v_reward);
end $$;
