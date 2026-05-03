-- ─── 00234: Ressourcen-Truhen + Random-Pakete + Vertrauen-Rename ─────
-- 1) Wächter-XP umbenannt → "Vertrauen" (Vertrauensmünzen, Vertrauen-Buch).
-- 2) Neue Items: Ressourcen-Pakete (random) + Auswahl-Truhen (3 Stufen).
-- 3) consume_resource_chest RPC — random pick oder choice text param.
-- 4) Truhe-Schlüssel-Mechanik: chest_silver/chest_gold benötigen passenden Key
--    in consume — neue RPC consume_chest_with_key(item_id).

-- ─── Rename: Elixier → Vertrauensmünze ─────────────────────────────
update public.inventory_item_catalog
set name = 'Vertrauensmünze (5.000)',
    description = 'Gewährt 5.000 Vertrauen für deinen Wächter.',
    emoji = '🪙'
where id = 'elixir_5k';

update public.inventory_item_catalog
set name = 'Vertrauensmünze (20.000)',
    description = 'Gewährt 20.000 Vertrauen für deinen Wächter.',
    emoji = '🪙'
where id = 'elixir_20k';

-- ─── Neue Items: Ressourcen-Pakete + Auswahl-Truhen ──────────────
-- payload-Format:
--   normal-pack:   {"kind":"random_one","options":[{"resource":"gold","amount":10000}, ...]}
--   choice-truhe:  {"kind":"choice_one","options":[{"resource":"gold","amount":50000}, ...]}
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active) values
  ('res_pack_normal', 'chest', 'Normales Ressourcen-Paket',
   'Du erhältst entweder 10.000 Krypto, 10.000 Tech-Schrott, 7.500 Komponenten oder 5.000 Bandbreite.',
   '📦', 'rare',
   '{"kind":"random_one","options":[
     {"resource":"gold","amount":10000},
     {"resource":"wood","amount":10000},
     {"resource":"stone","amount":7500},
     {"resource":"mana","amount":5000}
   ]}'::jsonb, 100, true),
  ('res_chest_choice_t1', 'chest', 'Auswahl-Ressourcen-Truhe (Stufe 1)',
   'Wähle 50.000 Krypto / Tech-Schrott / Komponenten oder 35.000 Bandbreite.',
   '🎁', 'rare',
   '{"kind":"choice_one","options":[
     {"resource":"gold","amount":50000},
     {"resource":"wood","amount":50000},
     {"resource":"stone","amount":37500},
     {"resource":"mana","amount":25000}
   ]}'::jsonb, 110, true),
  ('res_chest_choice_t2', 'chest', 'Auswahl-Ressourcen-Truhe (Stufe 2)',
   'Wähle 100.000 Krypto / Tech-Schrott / 75.000 Komponenten oder 50.000 Bandbreite.',
   '🎁', 'epic',
   '{"kind":"choice_one","options":[
     {"resource":"gold","amount":100000},
     {"resource":"wood","amount":100000},
     {"resource":"stone","amount":75000},
     {"resource":"mana","amount":50000}
   ]}'::jsonb, 120, true),
  ('res_chest_choice_t3', 'chest', 'Auswahl-Ressourcen-Truhe (Stufe 3)',
   'Wähle 150.000 Krypto / Tech-Schrott / 112.500 Komponenten oder 75.000 Bandbreite.',
   '🎁', 'legendary',
   '{"kind":"choice_one","options":[
     {"resource":"gold","amount":150000},
     {"resource":"wood","amount":150000},
     {"resource":"stone","amount":112500},
     {"resource":"mana","amount":75000}
   ]}'::jsonb, 130, true)
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      emoji = excluded.emoji,
      rarity = excluded.rarity,
      payload = excluded.payload,
      sort_order = excluded.sort_order;

-- ─── Helper: add_user_resources ────────────────────────────────────
-- Zentraler Punkt RSS zu vergeben (idempotent / upsert in user_resources).
create or replace function public.add_user_resources(
  p_user uuid,
  p_wood int default 0,
  p_stone int default 0,
  p_gold int default 0,
  p_mana int default 0,
  p_speed_tokens int default 0
) returns void language plpgsql security definer as $$
begin
  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (p_user,
          greatest(0, p_wood),
          greatest(0, p_stone),
          greatest(0, p_gold),
          greatest(0, p_mana),
          greatest(0, p_speed_tokens))
  on conflict (user_id) do update set
    wood = public.user_resources.wood + greatest(0, p_wood),
    stone = public.user_resources.stone + greatest(0, p_stone),
    gold = public.user_resources.gold + greatest(0, p_gold),
    mana = public.user_resources.mana + greatest(0, p_mana),
    speed_tokens = public.user_resources.speed_tokens + greatest(0, p_speed_tokens);
end $$;
grant execute on function public.add_user_resources(uuid, int, int, int, int, int) to authenticated, service_role;

-- ─── consume_resource_chest: random oder choice ──────────────────
create or replace function public.consume_resource_chest(
  p_item_id text,
  p_choice text default null  -- nur bei choice_one: 'gold' | 'wood' | 'stone' | 'mana'
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_count int;
  v_payload jsonb;
  v_kind text;
  v_options jsonb;
  v_pick jsonb;
  v_resource text;
  v_amount int;
  v_w int := 0; v_s int := 0; v_g int := 0; v_m int := 0;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select count into v_count from public.user_inventory_items
  where user_id = v_user and item_id = p_item_id;
  if coalesce(v_count, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_stock');
  end if;

  select payload into v_payload from public.inventory_item_catalog where id = p_item_id;
  if v_payload is null then return jsonb_build_object('ok', false, 'error', 'unknown_item'); end if;

  v_kind := v_payload->>'kind';
  v_options := v_payload->'options';

  if v_kind = 'random_one' then
    -- gleichverteilt
    v_pick := v_options->((floor(random() * jsonb_array_length(v_options)))::int);
  elsif v_kind = 'choice_one' then
    if p_choice is null then return jsonb_build_object('ok', false, 'error', 'choice_required'); end if;
    select opt into v_pick from jsonb_array_elements(v_options) opt where opt->>'resource' = p_choice;
    if v_pick is null then return jsonb_build_object('ok', false, 'error', 'invalid_choice'); end if;
  else
    return jsonb_build_object('ok', false, 'error', 'unsupported_chest');
  end if;

  v_resource := v_pick->>'resource';
  v_amount := (v_pick->>'amount')::int;

  if v_resource = 'wood'  then v_w := v_amount;
  elsif v_resource = 'stone' then v_s := v_amount;
  elsif v_resource = 'gold'  then v_g := v_amount;
  elsif v_resource = 'mana'  then v_m := v_amount;
  else return jsonb_build_object('ok', false, 'error', 'invalid_resource');
  end if;

  -- 1) Item dekrementieren
  update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = p_item_id;
  delete from public.user_inventory_items where user_id = v_user and item_id = p_item_id and count <= 0;

  -- 2) RSS gutschreiben
  perform public.add_user_resources(v_user, v_w, v_s, v_g, v_m, 0);

  return jsonb_build_object('ok', true, 'resource', v_resource, 'amount', v_amount);
end $$;
grant execute on function public.consume_resource_chest(text, text) to authenticated;

-- ─── consume_chest_with_key: silber/gold-Truhe braucht passenden Key ─
-- Verbraucht 1 Truhe + 1 Key, gibt random Loot über grant_inventory_item / RSS zurück.
create or replace function public.consume_chest_with_key(p_chest_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_chest record;
  v_tier text;
  v_key_id text;
  v_key_count int;
  v_chest_count int;
  v_reward jsonb := '[]'::jsonb;
  -- Loot-Pool je Tier
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

  -- Stock prüfen
  select count into v_chest_count from public.user_inventory_items where user_id = v_user and item_id = p_chest_id;
  if coalesce(v_chest_count, 0) < 1 then return jsonb_build_object('ok', false, 'error', 'no_chest'); end if;

  -- Tier-spezifische Schlüssel-Anforderung
  if v_tier = 'silver' then v_key_id := 'key_silver';
  elsif v_tier = 'gold' then v_key_id := 'key_gold';
  elsif v_tier in ('event','legendary') then v_key_id := null;  -- ohne Schlüssel öffenbar
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

  -- Truhe verbrauchen
  update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = p_chest_id;
  delete from public.user_inventory_items where user_id = v_user and item_id = p_chest_id and count <= 0;

  -- Loot-Roll je Tier
  if v_tier = 'silver' then
    perform public.add_user_resources(v_user, v_silver_gold, v_silver_gold, v_silver_gold, 0, 0);
    perform public.grant_inventory_item(v_user, 'speedup_uni_15m', v_silver_speed_count);
    v_reward := jsonb_build_array(
      jsonb_build_object('kind','rss','wood',v_silver_gold,'stone',v_silver_gold,'gold',v_silver_gold),
      jsonb_build_object('kind','item','item_id','speedup_uni_15m','count',v_silver_speed_count));
  elsif v_tier = 'gold' then
    -- Gems via user_gems upsert (falls existiert)
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
    perform public.grant_inventory_item(v_user, 'elixir_20k', 1);
    v_reward := jsonb_build_array(
      jsonb_build_object('kind','gems','amount',v_legendary_gems),
      jsonb_build_object('kind','item','item_id','speedup_build_8h','count',1),
      jsonb_build_object('kind','item','item_id','res_chest_choice_t2','count',1),
      jsonb_build_object('kind','item','item_id','elixir_20k','count',1));
  end if;

  return jsonb_build_object('ok', true, 'tier', v_tier, 'reward', v_reward);
end $$;
grant execute on function public.consume_chest_with_key(text) to authenticated;
