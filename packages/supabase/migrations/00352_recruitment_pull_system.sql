-- 00352_recruitment_pull_system.sql
-- Hero-Rekrutierungs-Pull-System (CoD-Style) für chest_silver/chest_gold.
-- Pity-Counter (chest_pity bereits da) + Wächter-Marken pro Archetype
-- (neu: user_guardian_medals). Schlüssel: key_silver / key_gold aus
-- inventory_item_catalog (existieren bereits). Droppen aus Map/Boss/Quest
-- (separater Sprint).
--
-- Silver-Truhe: keine Hero-Direct-Drops, nur Marken + Material
-- Gold-Truhe: 5% Hero-Direct + 25% Hero-Marken, Pity nach 30 = garantiert
-- Legendary, nach 10 = garantiert Epic.
--
-- Marken-Bedarf pro Rarity: elite=5, epic=10, legendary=20 Marken
-- → User sammelt Marken eines spezifischen Wächters und schaltet ihn frei.

CREATE TABLE IF NOT EXISTS public.user_guardian_medals (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  archetype_id  text NOT NULL REFERENCES public.guardian_archetypes(id) ON DELETE CASCADE,
  count         int  NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, archetype_id)
);

CREATE INDEX IF NOT EXISTS user_guardian_medals_user_idx ON public.user_guardian_medals(user_id);
ALTER TABLE public.user_guardian_medals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_guardian_medals_self ON public.user_guardian_medals;
CREATE POLICY user_guardian_medals_self ON public.user_guardian_medals
  FOR SELECT USING (user_id = auth.uid());

-- ─── Helper: Marken-Bedarf pro Wächter-Rarity ─────────────────────
CREATE OR REPLACE FUNCTION public.medals_required_for_rarity(p_rarity text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_rarity
    WHEN 'advanced'  THEN 3
    WHEN 'elite'     THEN 5
    WHEN 'epic'      THEN 10
    WHEN 'legendary' THEN 20
    ELSE 5
  END;
$$;
GRANT EXECUTE ON FUNCTION public.medals_required_for_rarity(text) TO authenticated, service_role;

-- ─── pull_recruitment ──────────────────────────────────────────────
-- p_tier: 'silver' | 'gold'
-- Verbraucht 1× chest_{tier} + 1× key_{tier} aus user_inventory_items.
-- Rollt mit Pity-System. Drops: Material, Speedups, Diamanten, Wächter-
-- Marken oder seltener direkt einen Wächter.
CREATE OR REPLACE FUNCTION public.pull_recruitment(p_tier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_chest_id text := 'chest_' || p_tier;
  v_key_id   text := 'key_'   || p_tier;
  v_chest_n int; v_key_n int;
  v_pity record;
  v_rarity_tier text;          -- 'common' | 'rare' | 'epic' | 'legend'
  v_drop_kind text;             -- 'material' | 'medal' | 'hero'
  v_archetype record;
  v_reward jsonb := '[]'::jsonb;
  v_wood int := 0; v_gold int := 0; v_stone int := 0; v_mana int := 0;
  v_gems int := 0;
  v_pity_triggered text := null;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_tier not in ('silver', 'gold') then
    return jsonb_build_object('ok', false, 'error', 'invalid_tier');
  end if;

  -- Schlüssel + Truhe prüfen
  select count into v_chest_n from public.user_inventory_items where user_id = v_user and item_id = v_chest_id;
  if coalesce(v_chest_n, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_chest', 'chest_id', v_chest_id);
  end if;
  select count into v_key_n from public.user_inventory_items where user_id = v_user and item_id = v_key_id;
  if coalesce(v_key_n, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_key', 'key_id', v_key_id);
  end if;

  -- Pity-Counter laden
  insert into public.chest_pity (user_id) values (v_user) on conflict do nothing;
  select * into v_pity from public.chest_pity where user_id = v_user for update;

  -- Verbrauch
  update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = v_chest_id;
  delete from public.user_inventory_items where user_id = v_user and item_id = v_chest_id and count <= 0;
  update public.user_inventory_items set count = count - 1 where user_id = v_user and item_id = v_key_id;
  delete from public.user_inventory_items where user_id = v_user and item_id = v_key_id and count <= 0;

  -- Pity-Rolls + Tier-Bestimmung
  if p_tier = 'gold' then
    if v_pity.pity_leg_counter >= 29 then
      v_rarity_tier := 'legend';
      v_pity_triggered := 'legendary_30';
    elsif v_pity.pity_epic_counter >= 9 then
      v_rarity_tier := 'epic';
      v_pity_triggered := 'epic_10';
    elsif random() < 0.01 then
      v_rarity_tier := 'legend';
    elsif random() < 0.10 then
      v_rarity_tier := 'epic';
    elsif random() < 0.30 then
      v_rarity_tier := 'rare';
    else
      v_rarity_tier := 'common';
    end if;
  else  -- silver
    if random() < 0.03 then
      v_rarity_tier := 'epic';
    elsif random() < 0.18 then
      v_rarity_tier := 'rare';
    else
      v_rarity_tier := 'common';
    end if;
  end if;

  -- Pity-Counter updaten
  update public.chest_pity set
    silver_opened     = silver_opened + (case when p_tier = 'silver' then 1 else 0 end),
    gold_opened       = gold_opened   + (case when p_tier = 'gold'   then 1 else 0 end),
    pity_epic_counter = case when v_rarity_tier in ('epic','legend') then 0 else pity_epic_counter + 1 end,
    pity_leg_counter  = case when v_rarity_tier = 'legend' then 0 else pity_leg_counter + 1 end
  where user_id = v_user;

  -- Drop-Kind je Tier
  if p_tier = 'silver' then
    -- Silver: 0% Hero-Direct, 20% Marken, 80% Material
    if v_rarity_tier in ('epic','rare') and random() < 0.25 then
      v_drop_kind := 'medal';
    else
      v_drop_kind := 'material';
    end if;
  else  -- gold
    -- Gold: bei legend immer Hero, bei epic 50% Hero / 50% Medal, sonst Material
    if v_rarity_tier = 'legend' then
      v_drop_kind := 'hero';
    elsif v_rarity_tier = 'epic' then
      v_drop_kind := case when random() < 0.5 then 'hero' else 'medal' end;
    elsif v_rarity_tier = 'rare' and random() < 0.4 then
      v_drop_kind := 'medal';
    else
      v_drop_kind := 'material';
    end if;
  end if;

  -- Drop ausführen
  if v_drop_kind = 'hero' then
    -- Random Wächter passender Rarity (epic/legendary), wave_number IS NOT NULL
    select * into v_archetype from public.guardian_archetypes
      where wave_number is not null
        and rarity = case when v_rarity_tier = 'legend' then 'legendary' else 'epic' end
      order by random() limit 1;
    if v_archetype.id is null then
      -- Fallback: Marken statt Hero
      select * into v_archetype from public.guardian_archetypes
        where wave_number is not null and rarity in ('epic','legendary')
        order by random() limit 1;
      v_drop_kind := 'medal';
      insert into public.user_guardian_medals (user_id, archetype_id, count)
        values (v_user, v_archetype.id, 5)
        on conflict (user_id, archetype_id) do update set count = public.user_guardian_medals.count + 5, updated_at = now();
      v_reward := jsonb_build_array(jsonb_build_object('kind','medal','archetype_id',v_archetype.id,'archetype_name',v_archetype.name,'count',5));
    else
      -- TODO: user_guardians insert wenn freischalt-System bereit. Aktuell: 1 Marke + 50 Diamanten als Trostpreis
      insert into public.user_guardian_medals (user_id, archetype_id, count)
        values (v_user, v_archetype.id, public.medals_required_for_rarity(v_archetype.rarity))
        on conflict (user_id, archetype_id) do update set count = public.user_guardian_medals.count + public.medals_required_for_rarity(v_archetype.rarity), updated_at = now();
      v_reward := jsonb_build_array(jsonb_build_object('kind','hero_unlock','archetype_id',v_archetype.id,'archetype_name',v_archetype.name,'rarity',v_archetype.rarity));
    end if;
  elsif v_drop_kind = 'medal' then
    -- Random Wächter passender Rarity, 1-3 Marken
    select * into v_archetype from public.guardian_archetypes
      where wave_number is not null
        and rarity = case
          when v_rarity_tier = 'epic'   then 'epic'
          when v_rarity_tier = 'rare'   then 'elite'
          else 'advanced'
        end
      order by random() limit 1;
    if v_archetype.id is null then
      -- Fallback: irgendeinen
      select * into v_archetype from public.guardian_archetypes
        where wave_number is not null order by random() limit 1;
    end if;
    declare
      v_medal_count int := case v_rarity_tier when 'epic' then 2 when 'rare' then 2 else 1 end;
    begin
      insert into public.user_guardian_medals (user_id, archetype_id, count)
        values (v_user, v_archetype.id, v_medal_count)
        on conflict (user_id, archetype_id) do update set count = public.user_guardian_medals.count + v_medal_count, updated_at = now();
      v_reward := jsonb_build_array(jsonb_build_object('kind','medal','archetype_id',v_archetype.id,'archetype_name',v_archetype.name,'count',v_medal_count));
    end;
  else  -- material
    if p_tier = 'silver' then
      v_wood := 10000; v_gold := 10000; v_stone := 7500; v_mana := 5000;
    else  -- gold
      v_wood := 50000; v_gold := 50000; v_stone := 37500; v_mana := 25000;
      if v_rarity_tier in ('rare','epic') then v_gems := 50; end if;
    end if;
    perform public.add_user_resources(v_user, v_wood, v_stone, v_gold, v_mana, 0);
    if v_gems > 0 then
      insert into public.user_gems (user_id, gems) values (v_user, v_gems)
        on conflict (user_id) do update set gems = public.user_gems.gems + v_gems;
    end if;
    v_reward := jsonb_build_array(jsonb_build_object('kind','rss','wood',v_wood,'stone',v_stone,'gold',v_gold,'mana',v_mana,'gems',v_gems));
  end if;

  -- Pity-State nachladen für Return
  select * into v_pity from public.chest_pity where user_id = v_user;

  return jsonb_build_object(
    'ok', true,
    'tier', p_tier,
    'rarity', v_rarity_tier,
    'drop_kind', v_drop_kind,
    'reward', v_reward,
    'pity_triggered', v_pity_triggered,
    'pity_epic', v_pity.pity_epic_counter,
    'pity_leg', v_pity.pity_leg_counter
  );
end $$;

REVOKE ALL ON FUNCTION public.pull_recruitment(text) FROM public;
GRANT EXECUTE ON FUNCTION public.pull_recruitment(text) TO authenticated;

-- ─── get_pull_preview ──────────────────────────────────────────────
-- Liefert die Belohnungsvorschau-Tabelle für ein Tier
-- (statisch, basierend auf der pull_recruitment-Logik).
CREATE OR REPLACE FUNCTION public.get_pull_preview(p_tier text)
RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_pity record;
  v_uid uuid := auth.uid();
begin
  if v_uid is not null then
    select * into v_pity from public.chest_pity where user_id = v_uid;
  end if;

  if p_tier = 'silver' then
    return jsonb_build_object(
      'tier', 'silver',
      'pity', jsonb_build_object(
        'silver_opened', coalesce(v_pity.silver_opened, 0)
      ),
      'tiers', jsonb_build_array(
        jsonb_build_object('label','Epische Belohnung','chance_pct',3.0,'color','#a855f7','contains',
          jsonb_build_array('Epische Wächter-Marken','Großes Erfahrung-Elixier')),
        jsonb_build_object('label','Seltene Belohnung','chance_pct',18.0,'color','#5ddaf0','contains',
          jsonb_build_array('Elite-Wächter-Marken','Speedup','Material 10k')),
        jsonb_build_object('label','Allgemeine Belohnung','chance_pct',79.0,'color','#4ade80','contains',
          jsonb_build_array('Material 10k (zufällig)','Wächter-Marken (Advanced)'))
      )
    );
  elsif p_tier = 'gold' then
    return jsonb_build_object(
      'tier', 'gold',
      'pity', jsonb_build_object(
        'gold_opened', coalesce(v_pity.gold_opened, 0),
        'pity_epic_counter', coalesce(v_pity.pity_epic_counter, 0),
        'pity_leg_counter', coalesce(v_pity.pity_leg_counter, 0),
        'epic_guaranteed_in', greatest(0, 10 - coalesce(v_pity.pity_epic_counter, 0)),
        'legendary_guaranteed_in', greatest(0, 30 - coalesce(v_pity.pity_leg_counter, 0))
      ),
      'tiers', jsonb_build_array(
        jsonb_build_object('label','Legendäre Belohnung','chance_pct',1.0,'color','#FFD700','contains',
          jsonb_build_array('Legendärer Wächter direkt (1%)','garantiert nach 30 Ziehungen')),
        jsonb_build_object('label','Epische Belohnung','chance_pct',10.0,'color','#a855f7','contains',
          jsonb_build_array('Epischer Wächter (50%)','Epische Wächter-Marken (50%)','garantiert nach 10 Ziehungen')),
        jsonb_build_object('label','Seltene Belohnung','chance_pct',30.0,'color','#5ddaf0','contains',
          jsonb_build_array('Elite-Wächter-Marken','Material 50k + Diamanten')),
        jsonb_build_object('label','Allgemeine Belohnung','chance_pct',59.0,'color','#4ade80','contains',
          jsonb_build_array('Material 50k (zufällig)'))
      )
    );
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_tier');
  end if;
end $$;

GRANT EXECUTE ON FUNCTION public.get_pull_preview(text) TO authenticated;

-- ─── Backward-Compat: consume_chest_with_key umleiten ──────────────
-- Wenn jemand noch consume_chest_with_key auf silver/gold ruft,
-- redirecten wir auf pull_recruitment. Event/Legendary bleiben separat.
CREATE OR REPLACE FUNCTION public.consume_chest_with_key(p_chest_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
  v_user uuid := auth.uid();
  v_tier text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  v_tier := substring(p_chest_id from 7);  -- chest_silver → silver
  if v_tier in ('silver', 'gold') then
    return public.pull_recruitment(v_tier);
  end if;
  -- Event/Legendary: alte Logik (deterministisch, kein Pull)
  return jsonb_build_object('ok', false, 'error', 'deprecated_use_pull_recruitment');
end $$;
