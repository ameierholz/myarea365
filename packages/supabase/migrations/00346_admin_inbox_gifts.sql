-- 00346_admin_inbox_gifts.sql
-- Admin-Tool: Geschenke/Entschädigungen an einzelne Spieler senden.
-- Beliebige Kombination aus Resources (wood/stone/gold/mana/gems/
-- speed_tokens) und Items (jeder Eintrag aus inventory_item_catalog
-- ODER guardian_xp_items, plus existing kategorisiert über catalog_id).
-- Frontend rendert items[] generisch via SystemRewardView.
--
-- Plus: claim_inbox_rewards erweitert um inventory_item_catalog-Items
-- (bisher nur guardian_xp_items). Reihenfolge: erst guardian_xp_items
-- (xp_pot_*), dann fallback auf inventory_item_catalog.

-- ─── claim_inbox_rewards: erweitert um inventory_item_catalog ───────
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
  v_routed boolean;
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
      insert into public.user_gems (user_id, gems) values (v_user, v_gems)
      on conflict (user_id) do update set gems = public.user_gems.gems + v_gems, updated_at = now();
    end if;

    -- items[]: guardian_xp_items zuerst, sonst inventory_item_catalog
    if jsonb_typeof(r.reward_payload->'items') = 'array' then
      for it in select * from jsonb_array_elements(r.reward_payload->'items') loop
        v_item_id := coalesce(it->>'item_id', it->>'catalog_id');
        v_item_count := coalesce((it->>'count')::int, 1);
        if v_item_id is null or v_item_count <= 0 then continue; end if;
        v_routed := false;

        if exists (select 1 from public.guardian_xp_items where id = v_item_id) then
          insert into public.user_guardian_xp_items (user_id, item_id, count)
          values (v_user, v_item_id, v_item_count)
          on conflict (user_id, item_id) do update set
            count = public.user_guardian_xp_items.count + excluded.count,
            updated_at = now();
          v_routed := true;
        elsif exists (select 1 from public.inventory_item_catalog where id = v_item_id) then
          perform public.grant_inventory_item(v_user, v_item_id, v_item_count);
          v_routed := true;
        end if;

        if v_routed then v_total_items := v_total_items + v_item_count; end if;
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

-- ─── admin_send_inbox_gift ─────────────────────────────────────────
-- Sendet eine Inbox-Nachricht an einen Spieler mit beliebigen Resources
-- + Items. Nur Admin/Super-Admin darf aufrufen.
CREATE OR REPLACE FUNCTION public.admin_send_inbox_gift(
  p_recipient_id uuid,
  p_title text,
  p_body text,
  p_resources jsonb DEFAULT '{}'::jsonb,  -- { wood, stone, gold, mana, gems, speed_tokens }
  p_items jsonb     DEFAULT '[]'::jsonb,  -- [{ catalog_id|item_id, count }]
  p_reason text     DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_payload jsonb;
  v_inbox_id uuid;
begin
  if v_caller is null then raise exception 'unauthorized'; end if;
  select role::text into v_caller_role from public.users where id = v_caller;
  if v_caller_role not in ('admin','super_admin') then
    raise exception 'forbidden_admin_only';
  end if;

  if p_recipient_id is null then raise exception 'recipient_required'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title_required'; end if;

  -- Reward-Payload zusammenbauen
  v_payload := coalesce(p_resources, '{}'::jsonb);
  if jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    v_payload := v_payload || jsonb_build_object('items', p_items);
  end if;

  -- Nur Insert wenn irgendwas zu claimen ist, sonst pure Info-Nachricht
  insert into public.user_inbox (
    user_id, category, subcategory, kind,
    title, body, reward_payload,
    payload, from_user_id, from_label
  ) values (
    p_recipient_id,
    'system', NULL, 'admin_gift',
    p_title, p_body,
    case when v_payload = '{}'::jsonb then null else v_payload end,
    jsonb_build_object('granted_by', v_caller, 'reason', coalesce(p_reason, 'manual_admin_gift')),
    v_caller, 'Admin'
  ) returning id into v_inbox_id;

  return jsonb_build_object('ok', true, 'inbox_id', v_inbox_id);
end $$;

REVOKE ALL ON FUNCTION public.admin_send_inbox_gift(uuid, text, text, jsonb, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_send_inbox_gift(uuid, text, text, jsonb, jsonb, text) TO authenticated;

-- ─── admin_send_inbox_gift_bulk ───────────────────────────────────
-- Variante für mehrere Empfänger (z. B. Wartungs-Kompensation an alle).
CREATE OR REPLACE FUNCTION public.admin_send_inbox_gift_bulk(
  p_recipient_ids uuid[],
  p_title text,
  p_body text,
  p_resources jsonb DEFAULT '{}'::jsonb,
  p_items jsonb     DEFAULT '[]'::jsonb,
  p_reason text     DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_uid uuid;
  v_count int := 0;
begin
  if v_caller is null then raise exception 'unauthorized'; end if;
  select role::text into v_caller_role from public.users where id = v_caller;
  if v_caller_role not in ('admin','super_admin') then
    raise exception 'forbidden_admin_only';
  end if;

  foreach v_uid in array p_recipient_ids loop
    perform public.admin_send_inbox_gift(v_uid, p_title, p_body, p_resources, p_items, p_reason);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'sent_count', v_count);
end $$;

REVOKE ALL ON FUNCTION public.admin_send_inbox_gift_bulk(uuid[], text, text, jsonb, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_send_inbox_gift_bulk(uuid[], text, text, jsonb, jsonb, text) TO authenticated;
