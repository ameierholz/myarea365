-- Erweitert purchase_daily_deal um den Content-Typ 'random_materials':
--   { "type": "random_materials", "amount": 3, "rarity": "common", "label": "3× Zufälliges Ausrüstungsmaterial" }
-- Ruft roll_material_drop() pro Roll auf — nutzt damit die bestehende
-- Rarity-gewichtete Material-Tabelle (scrap/crystal/essence/relikt).
--
-- Danach werden die Tages-Deals Bronze/Silber/Gold/Super mit
-- Ausrüstungsmaterialien (zufällig) angereichert.

-- Funktion neu anlegen (drop + create, damit wir den Case-Block sauber erweitern)
create or replace function public.purchase_daily_deal(p_pack_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_pack  public.daily_deal_packs%rowtype;
  v_gems_have int;
  v_is_eur boolean := false;
  v_entry jsonb;
  v_gem_reward int := 0;
  v_xp_hours int := 0;
  v_arena_days int := 0;
  v_seals_granted int := 0;
  v_potions_granted int := 0;
  v_materials_rolled int := 0;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select * into v_pack from public.daily_deal_packs where id = p_pack_id and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'pack_not_found'); end if;

  if exists (
    select 1 from public.user_daily_purchases
    where user_id = v_user and pack_id = p_pack_id and purchased_utc_date = v_today
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_purchased_today');
  end if;

  v_is_eur := v_pack.price_cents is not null and v_pack.price_cents > 0;

  if not v_is_eur then
    select gems into v_gems_have from public.user_gems where user_id = v_user;
    v_gems_have := coalesce(v_gems_have, 0);
    if v_gems_have < v_pack.price_gems then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gems', 'needed', v_pack.price_gems, 'have', v_gems_have);
    end if;
    update public.user_gems
      set gems = gems - v_pack.price_gems,
          total_spent = total_spent + v_pack.price_gems,
          updated_at = now()
      where user_id = v_user;
    insert into public.gem_transactions(user_id, delta, reason, metadata)
      values (v_user, -v_pack.price_gems, 'daily_deal', jsonb_build_object('pack_id', p_pack_id));
  end if;

  insert into public.user_siegel (user_id) values (v_user) on conflict (user_id) do nothing;
  insert into public.user_gems (user_id, gems) values (v_user, 0) on conflict (user_id) do nothing;

  for v_entry in select * from jsonb_array_elements(v_pack.contents) loop
    declare
      v_type text := v_entry->>'type';
      v_amount int := coalesce((v_entry->>'amount')::int, 0);
      v_min int := coalesce((v_entry->>'min')::int, 1);
      v_max int := coalesce((v_entry->>'max')::int, v_min);
      v_roll int;
      v_pick int;
      v_rarity text;
    begin
      case v_type
        when 'gems' then
          update public.user_gems
            set gems = gems + v_amount, total_purchased = total_purchased + v_amount, updated_at = now()
            where user_id = v_user;
          insert into public.gem_transactions(user_id, delta, reason, metadata)
            values (v_user, v_amount, 'daily_deal_bonus_gems', jsonb_build_object('pack_id', p_pack_id));
          v_gem_reward := v_gem_reward + v_amount;
        when 'xp_boost_hours' then
          insert into public.user_shop_purchases(user_id, shop_item_id, price_paid_gems, expires_at)
            select v_user, 'xp_boost_daily', 0, now() + (v_amount || ' hours')::interval
            where exists (select 1 from public.gem_shop_items where id = 'xp_boost_1h')
               or not exists (select 1 from public.gem_shop_items where id = 'xp_boost_daily');
          v_xp_hours := v_xp_hours + v_amount;
        when 'random_seals' then
          v_roll := floor(random() * (v_max - v_min + 1))::int + v_min;
          for i in 1..v_roll loop
            v_pick := floor(random() * 5)::int;
            if v_pick = 0 then
              update public.user_siegel set siegel_infantry = siegel_infantry + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 1 then
              update public.user_siegel set siegel_cavalry = siegel_cavalry + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 2 then
              update public.user_siegel set siegel_marksman = siegel_marksman + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 3 then
              update public.user_siegel set siegel_mage = siegel_mage + 1, updated_at = now() where user_id = v_user;
            else
              update public.user_siegel set siegel_universal = siegel_universal + 1, updated_at = now() where user_id = v_user;
            end if;
          end loop;
          v_seals_granted := v_seals_granted + v_roll;
        when 'random_potion' then
          v_rarity := coalesce(v_entry->>'rarity', 'common');
          perform public.grant_random_potion(v_user, v_rarity);
          v_potions_granted := v_potions_granted + 1;
        when 'random_materials' then
          v_rarity := coalesce(v_entry->>'rarity', 'common');
          for i in 1..greatest(v_amount, 1) loop
            perform public.roll_material_drop(v_user, v_rarity);
          end loop;
          v_materials_rolled := v_materials_rolled + greatest(v_amount, 1);
        when 'arena_pass_days' then
          update public.user_gems
            set arena_pass_expires_at = greatest(coalesce(arena_pass_expires_at, now()), now()) + (v_amount || ' days')::interval,
                updated_at = now()
            where user_id = v_user;
          v_arena_days := v_arena_days + v_amount;
        when 'respec_token', 'skin_token', 'pin_theme_token' then
          insert into public.user_shop_purchases(user_id, shop_item_id, price_paid_gems, expires_at)
            values (v_user, 'token_' || v_type, 0, null);
        else
          null;
      end case;
    end;
  end loop;

  insert into public.user_daily_purchases(user_id, pack_id, purchased_utc_date, price_gems_paid, contents)
    values (v_user, p_pack_id, v_today, case when v_is_eur then 0 else v_pack.price_gems end, v_pack.contents);

  return jsonb_build_object(
    'ok', true, 'pack_id', p_pack_id,
    'paid_eur_cents', case when v_is_eur then v_pack.price_cents else null end,
    'gems_spent', case when v_is_eur then 0 else v_pack.price_gems end,
    'gems_gained', v_gem_reward,
    'xp_boost_hours', v_xp_hours,
    'arena_pass_days', v_arena_days,
    'seals_granted', v_seals_granted,
    'potions_granted', v_potions_granted,
    'materials_rolled', v_materials_rolled,
    'contents', v_pack.contents
  );
end; $$;

grant execute on function public.purchase_daily_deal(text) to authenticated;

-- ═══ Materialien zu den Daily-Deals hinzufügen ═══
-- Knapp gehalten, da Materialien auch aus Fights droppen.
-- Bronze: 1 Roll (common), Silber: 2 (rare), Gold: 3 (epic), Super: 5 (epic)

update public.daily_deal_packs
set contents = contents || '[{"type":"random_materials","amount":1,"rarity":"common","label":"1× Ausrüstungsmaterial (zufällig)"}]'::jsonb
where id = 'daily_bronze' and not (contents::text like '%random_materials%');

update public.daily_deal_packs
set contents = contents || '[{"type":"random_materials","amount":2,"rarity":"rare","label":"2× Ausrüstungsmaterial (zufällig)"}]'::jsonb
where id = 'daily_silver' and not (contents::text like '%random_materials%');

update public.daily_deal_packs
set contents = contents || '[{"type":"random_materials","amount":3,"rarity":"epic","label":"3× Ausrüstungsmaterial (zufällig)"}]'::jsonb
where id = 'daily_gold' and not (contents::text like '%random_materials%');

update public.daily_deal_packs
set contents = contents || '[{"type":"random_materials","amount":5,"rarity":"epic","label":"5× Ausrüstungsmaterial (zufällig)"}]'::jsonb
where id = 'daily_super' and not (contents::text like '%random_materials%');
