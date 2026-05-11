-- 00341_claim_inbox_items_support.sql
-- claim_inbox_rewards verarbeitete bisher nur Ressourcen (wood/stone/gold/
-- mana/speed_tokens). Frontend rendert aber bereits items[]-Pille im
-- SystemRewardView. Diese Migration verkabelt das: items[] mit guardian-
-- XP-Elixier-IDs (xp_pot_s/m/l) werden auf user_guardian_xp_items
-- gebucht. Andere item_id-Prefixe werden ignoriert (kommen später dazu).

CREATE OR REPLACE FUNCTION public.claim_inbox_rewards(p_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_total_w int := 0; v_total_s int := 0; v_total_g int := 0; v_total_m int := 0; v_total_t int := 0;
  v_total_gems int := 0;
  v_total_items int := 0;
  v_n int := 0;
  r record;
  v_w int; v_s int; v_g int; v_mn int; v_t int; v_gems int;
  v_new_gold bigint;
  it jsonb;
  v_item_id text;
  v_item_count int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  for r in
    select id, reward_payload from public.user_inbox
     where user_id = v_user
       and deleted_at is null
       and reward_payload is not null
       and claimed_at is null
       and (p_ids is null or id = any(p_ids))
  loop
    v_w    := coalesce((r.reward_payload->>'wood')::int, 0);
    v_s    := coalesce((r.reward_payload->>'stone')::int, 0);
    v_g    := coalesce((r.reward_payload->>'gold')::int, 0);
    v_mn   := coalesce((r.reward_payload->>'mana')::int, 0);
    v_t    := coalesce((r.reward_payload->>'speed_tokens')::int, 0);
    v_gems := coalesce((r.reward_payload->>'gems')::int, 0);

    if (v_w + v_s + v_g + v_mn + v_t) > 0 then
      insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
      values (v_user, v_w, v_s, v_g, v_mn, v_t)
      on conflict (user_id) do update set
        wood         = public.user_resources.wood + excluded.wood,
        stone        = public.user_resources.stone + excluded.stone,
        gold         = public.user_resources.gold + excluded.gold,
        mana         = public.user_resources.mana + excluded.mana,
        speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
        updated_at   = now();
    end if;

    if v_gems > 0 then
      update public.users set gems = coalesce(gems, 0) + v_gems where id = v_user;
    end if;

    -- items[]: aktuell nur guardian_xp_items unterstützt (xp_pot_s/m/l)
    if jsonb_typeof(r.reward_payload->'items') = 'array' then
      for it in select * from jsonb_array_elements(r.reward_payload->'items') loop
        v_item_id := it->>'item_id';
        v_item_count := coalesce((it->>'count')::int, 1);
        if v_item_id is null or v_item_count <= 0 then continue; end if;

        if exists (select 1 from public.guardian_xp_items where id = v_item_id) then
          insert into public.user_guardian_xp_items (user_id, item_id, count)
          values (v_user, v_item_id, v_item_count)
          on conflict (user_id, item_id) do update set
            count = public.user_guardian_xp_items.count + excluded.count,
            updated_at = now();
          v_total_items := v_total_items + v_item_count;
        end if;
      end loop;
    end if;

    update public.user_inbox set claimed_at = now(), read_at = coalesce(read_at, now())
     where id = r.id;
    v_total_w := v_total_w + v_w; v_total_s := v_total_s + v_s;
    v_total_g := v_total_g + v_g; v_total_m := v_total_m + v_mn;
    v_total_t := v_total_t + v_t; v_total_gems := v_total_gems + v_gems;
    v_n := v_n + 1;
  end loop;

  if v_total_w > 0 then perform public.stat_increment(v_user, 'holz_total_collected', v_total_w); end if;
  if v_total_s > 0 then perform public.stat_increment(v_user, 'stein_total_collected', v_total_s); end if;
  if v_total_g > 0 then perform public.stat_increment(v_user, 'gold_total_collected', v_total_g); end if;
  if v_total_m > 0 then perform public.stat_increment(v_user, 'mana_total_collected', v_total_m); end if;
  if v_total_g > 0 then
    select gold into v_new_gold from public.user_resources where user_id = v_user;
    if v_new_gold is not null then
      perform public.stat_set_max(v_user, 'gold_peak', v_new_gold);
    end if;
  end if;

  return jsonb_build_object('ok', true,
    'claimed_count', v_n,
    'wood', v_total_w, 'stone', v_total_s,
    'gold', v_total_g, 'mana', v_total_m,
    'speed_tokens', v_total_t,
    'gems', v_total_gems,
    'items_added', v_total_items);
end $$;
