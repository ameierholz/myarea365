-- 00035: Siegel-Drop rebalancen
-- Bisher: JEDER Kampf → 1 Siegel (Sieg: getypt, Niederlage: universal).
-- Bei 15 Fights/Tag ⇒ 15 garantierte Siegel. Zu viel.
--
-- Neu:
--   • Sieg: 45% Basis-Chance + 15% wenn stärkerer Gegner (Level+); max 60%.
--   • Niederlage: 10% Chance auf Universal (nicht mehr garantiert).
--   • Upset-Bonus: Bei >=2 Level Unterschied (gewonnen) zusätzlich +25% Chance.
--
-- Ergebnis: ~6-9 Siegel/Tag bei 15 Fights — Loot fühlt sich wieder nach Loot an.

create or replace function public.runner_fight_settle(
  p_attacker_id uuid,
  p_defender_id uuid,
  p_attacker_guardian_id uuid,
  p_defender_guardian_id uuid,
  p_winner_user_id uuid,
  p_seed bigint,
  p_rounds jsonb,
  p_gems_paid int
) returns jsonb language plpgsql security definer as $$
declare
  v_won boolean;
  v_level_attacker int;
  v_level_defender int;
  v_level_diff int;
  v_xp int;
  v_rarity text := 'none';
  v_siegel_type text := null;
  v_item_id text;
  v_user_item_id uuid;
  v_fight_id uuid;
  v_roll float;
  v_siegel_roll float;
  v_siegel_chance float;
begin
  -- Anti-Abuse: gleicher Verteidiger max 2× pro Tag
  if (select count(*) from public.runner_fights
        where attacker_id = p_attacker_id and defender_id = p_defender_id
          and created_at > current_date) >= 2 then
    return jsonb_build_object('ok', false, 'error', 'defender_cap_reached');
  end if;

  v_won := (p_winner_user_id = p_attacker_id);
  select level into v_level_attacker from public.user_guardians where id = p_attacker_guardian_id;
  select level into v_level_defender from public.user_guardians where id = p_defender_guardian_id;
  v_level_diff := coalesce(v_level_defender, 0) - coalesce(v_level_attacker, 0);

  if v_won then
    -- XP: 80 base + 10 pro Gegner-Level, +50% wenn stärkerer Gegner
    v_xp := 80 + (coalesce(v_level_defender, 1) * 10);
    if v_level_diff > 0 then v_xp := (v_xp * 15) / 10; end if;

    -- Loot-Roll (Sieg)
    v_roll := random();
    if v_level_diff >= 2 and v_roll < 0.10 then
      v_rarity := 'epic';
    elsif v_roll < 0.35 then
      v_rarity := 'rare';
    else
      v_rarity := 'common';
    end if;

    -- Siegel-Chance: 45% Basis + 15% wenn stärkerer Gegner + 25% bei Upset (>=2 Level)
    v_siegel_chance := 0.45;
    if v_level_diff > 0 then v_siegel_chance := v_siegel_chance + 0.15; end if;
    if v_level_diff >= 2 then v_siegel_chance := v_siegel_chance + 0.25; end if;
    if v_siegel_chance > 0.85 then v_siegel_chance := 0.85; end if;

    v_siegel_roll := random();
    if v_siegel_roll < v_siegel_chance then
      insert into public.user_siegel (user_id) values (p_attacker_id) on conflict (user_id) do nothing;
      v_siegel_type := case (floor(random()*5)::int)
        when 0 then 'infantry' when 1 then 'cavalry' when 2 then 'marksman' when 3 then 'mage' else 'universal' end;
      execute format('update public.user_siegel set siegel_%s = siegel_%s + 1, updated_at = now() where user_id = $1', v_siegel_type, v_siegel_type)
        using p_attacker_id;
    end if;

    -- Item-Drop 15% (unverändert)
    if random() < 0.15 then
      select id into v_item_id from public.item_catalog
        where rarity = case v_rarity when 'epic' then 'epic' when 'rare' then 'rare' else 'common' end
        order by random() limit 1;
      if v_item_id is not null then
        insert into public.user_items (user_id, item_id, source)
          values (p_attacker_id, v_item_id, 'runner_fight') returning id into v_user_item_id;
      end if;
    end if;

    update public.user_guardians set wins = wins + 1, xp = xp + v_xp where id = p_attacker_guardian_id;
    update public.user_guardians set losses = losses + 1 where id = p_defender_guardian_id;
  else
    -- Niederlage: Trostpreis nur 10% der Zeit, sonst nur XP
    v_xp := 20;
    v_rarity := 'common';
    if random() < 0.10 then
      insert into public.user_siegel (user_id) values (p_attacker_id) on conflict (user_id) do nothing;
      update public.user_siegel set siegel_universal = siegel_universal + 1, updated_at = now()
        where user_id = p_attacker_id;
      v_siegel_type := 'universal';
    end if;

    update public.user_guardians set xp = xp + v_xp, losses = losses + 1 where id = p_attacker_guardian_id;
    update public.user_guardians set wins = wins + 1 where id = p_defender_guardian_id;
  end if;

  insert into public.runner_fights
    (attacker_id, defender_id, attacker_guardian_id, defender_guardian_id,
     winner_user_id, seed, rounds, xp_awarded, loot_rarity, siegel_type, item_id, user_item_id, gems_paid)
  values
    (p_attacker_id, p_defender_id, p_attacker_guardian_id, p_defender_guardian_id,
     p_winner_user_id, p_seed, p_rounds, v_xp, v_rarity, v_siegel_type, v_item_id, v_user_item_id, p_gems_paid)
  returning id into v_fight_id;

  return jsonb_build_object(
    'ok', true,
    'won', v_won,
    'xp', v_xp,
    'rarity', v_rarity,
    'siegel_type', v_siegel_type,      -- null wenn kein Drop
    'item_id', v_item_id,
    'user_item_id', v_user_item_id,
    'fight_id', v_fight_id
  );
end $$;
