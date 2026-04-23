-- 00053: Schmiede-Zeit-Gates (RoK-Style) + Material-Drop-Raten halbiert.
--
-- Kontext: Ohne Zeit-Gates und mit großzügigen Drop-Raten erreicht ein
-- Durchschnitts-Runner ein komplettes Gold-Set in ~4–6 Monaten. Rise of
-- Kingdoms als Benchmark braucht 6–12+ Monate. Das Problem: zu wenig
-- Progression-Tiefe → kein Langzeit-Ziel → Top-Spieler haben alles maxed
-- und verlieren Grind-Motivation.
--
-- Fix:
--   A) Zeit-Gates pro Schmiede-Vorgang (0h / 4h / 12h je Tier)
--   B) Drop-Raten halbiert (No-Drop-Chance + kleinere Mengen)
--
-- Materialien werden beim upgrade_item() SOFORT abgezogen (wie RoK).
-- Finalize-Schritt hebt den upgrade_tier erst nach Ablauf des Timers.
-- Tier-0→1 bleibt instant (Early-Win für neue Runner).

-- ═══════════════════════════════════════════════════════
-- 1) Crafting-State auf user_items
-- ═══════════════════════════════════════════════════════
alter table public.user_items
  add column if not exists crafting_target_tier int
    check (crafting_target_tier is null or (crafting_target_tier between 1 and 3)),
  add column if not exists crafting_ends_at timestamptz;

comment on column public.user_items.crafting_target_tier is
  'Ziel-Tier während aktives Schmieden läuft. NULL = kein Schmieden aktiv.';
comment on column public.user_items.crafting_ends_at is
  'Zeitpunkt, ab dem finalize_crafting() den Upgrade abschließen kann.';

create index if not exists idx_user_items_crafting
  on public.user_items(user_id, crafting_ends_at)
  where crafting_target_tier is not null;

-- ═══════════════════════════════════════════════════════
-- 2) Forge-Dauer pro Tier
-- ═══════════════════════════════════════════════════════
create or replace function public.forge_duration_seconds(p_current_tier int)
returns int language sql immutable as $$
  select case p_current_tier
    when 0 then 0           -- Grau → Grün: instant (Early-Win)
    when 1 then 4  * 3600   -- Grün → Lila: 4 Stunden
    when 2 then 12 * 3600   -- Lila → Gold: 12 Stunden
    else 0
  end;
$$;

grant execute on function public.forge_duration_seconds(int) to authenticated, anon;

-- ═══════════════════════════════════════════════════════
-- 3) upgrade_item() neu: Mats abziehen + Crafting-Timer setzen
-- ═══════════════════════════════════════════════════════
create or replace function public.upgrade_item(p_user_item_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_owner uuid;
  v_current_tier int;
  v_target_tier int;
  v_crafting_target int;
  v_duration_s int;
  v_ends_at timestamptz;
  v_cost jsonb;
  v_scrap int := 0; v_crystal int := 0; v_essence int := 0; v_relikt int := 0;
  v_have_scrap int; v_have_crystal int; v_have_essence int; v_have_relikt int;
begin
  select user_id, upgrade_tier, crafting_target_tier
    into v_owner, v_current_tier, v_crafting_target
    from public.user_items where id = p_user_item_id;
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_owner <> auth.uid() then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  if v_current_tier >= 3 then return jsonb_build_object('ok', false, 'error', 'already_maxed'); end if;
  if v_crafting_target is not null then
    return jsonb_build_object('ok', false, 'error', 'already_crafting');
  end if;

  v_cost := public.upgrade_cost(v_current_tier);
  v_scrap   := coalesce((v_cost->>'scrap')::int, 0);
  v_crystal := coalesce((v_cost->>'crystal')::int, 0);
  v_essence := coalesce((v_cost->>'essence')::int, 0);
  v_relikt  := coalesce((v_cost->>'relikt')::int, 0);

  select scrap, crystal, essence, relikt into v_have_scrap, v_have_crystal, v_have_essence, v_have_relikt
    from public.user_materials where user_id = v_owner;
  if v_have_scrap is null then v_have_scrap := 0; v_have_crystal := 0; v_have_essence := 0; v_have_relikt := 0; end if;

  if v_have_scrap   < v_scrap
  or v_have_crystal < v_crystal
  or v_have_essence < v_essence
  or v_have_relikt  < v_relikt then
    return jsonb_build_object('ok', false, 'error', 'not_enough_materials', 'cost', v_cost);
  end if;

  insert into public.user_materials (user_id) values (v_owner) on conflict (user_id) do nothing;
  update public.user_materials set
    scrap = scrap - v_scrap,
    crystal = crystal - v_crystal,
    essence = essence - v_essence,
    relikt = relikt - v_relikt,
    updated_at = now()
  where user_id = v_owner;

  v_target_tier := v_current_tier + 1;
  v_duration_s  := public.forge_duration_seconds(v_current_tier);

  if v_duration_s = 0 then
    -- Instant-Upgrade (Tier 0→1)
    update public.user_items
      set upgrade_tier = v_target_tier,
          crafting_target_tier = null,
          crafting_ends_at = null
      where id = p_user_item_id;
    return jsonb_build_object('ok', true, 'instant', true, 'new_tier', v_target_tier);
  end if;

  -- Zeit-gesperrtes Upgrade
  v_ends_at := now() + (v_duration_s || ' seconds')::interval;
  update public.user_items
    set crafting_target_tier = v_target_tier,
        crafting_ends_at = v_ends_at
    where id = p_user_item_id;

  return jsonb_build_object(
    'ok', true,
    'instant', false,
    'target_tier', v_target_tier,
    'crafting_ends_at', v_ends_at,
    'duration_seconds', v_duration_s
  );
end $$;

grant execute on function public.upgrade_item(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 4) finalize_crafting(): Timer abgelaufen → Tier anheben
-- ═══════════════════════════════════════════════════════
create or replace function public.finalize_crafting(p_user_item_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_owner uuid;
  v_target_tier int;
  v_ends_at timestamptz;
begin
  select user_id, crafting_target_tier, crafting_ends_at
    into v_owner, v_target_tier, v_ends_at
    from public.user_items where id = p_user_item_id;
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_owner <> auth.uid() then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  if v_target_tier is null then
    return jsonb_build_object('ok', false, 'error', 'not_crafting');
  end if;
  if v_ends_at > now() then
    return jsonb_build_object('ok', false, 'error', 'still_crafting', 'ends_at', v_ends_at);
  end if;

  update public.user_items
    set upgrade_tier = v_target_tier,
        crafting_target_tier = null,
        crafting_ends_at = null
    where id = p_user_item_id;

  return jsonb_build_object('ok', true, 'new_tier', v_target_tier);
end $$;

grant execute on function public.finalize_crafting(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 5) roll_material_drop() — Drop-Raten halbiert
--
-- Alt: Common (0% no-drop) · Rare (0%) · Epic (0%) · Legendary (0%)
-- Neu: Common (45% no-drop) · Rare (25%) · Epic (12%) · Legendary (5%)
-- Zusätzlich: Mengen-Ranges verkleinert. Relikt-Chancen leicht gesenkt.
-- ═══════════════════════════════════════════════════════
create or replace function public.roll_material_drop(p_user_id uuid, p_context_rarity text)
returns jsonb language plpgsql security definer as $$
declare
  v_roll float;
  v_material_id text;
  v_qty int := 1;
begin
  v_roll := random();

  if p_context_rarity = 'legendary' then
    -- 5% no-drop, 7% relikt, 33% essence, 55% crystal
    if v_roll < 0.05 then
      return jsonb_build_object('material_id', null, 'qty', 0);
    elsif v_roll < 0.12 then v_material_id := 'relikt';
    elsif v_roll < 0.45 then v_material_id := 'essence'; v_qty := 1;
    else v_material_id := 'crystal'; v_qty := 1 + floor(random()*2)::int;  -- 1-2 statt 2-4
    end if;
  elsif p_context_rarity = 'epic' then
    -- 12% no-drop, 2% relikt, 18% essence, 38% crystal, 30% scrap
    if v_roll < 0.12 then
      return jsonb_build_object('material_id', null, 'qty', 0);
    elsif v_roll < 0.14 then v_material_id := 'relikt';
    elsif v_roll < 0.32 then v_material_id := 'essence'; v_qty := 1;
    elsif v_roll < 0.70 then v_material_id := 'crystal'; v_qty := 1;           -- 1 statt 1-2
    else v_material_id := 'scrap'; v_qty := 1 + floor(random()*2)::int;        -- 1-2 statt 2-4
    end if;
  elsif p_context_rarity = 'rare' then
    -- 25% no-drop, 5% essence, 30% crystal, 40% scrap
    if v_roll < 0.25 then
      return jsonb_build_object('material_id', null, 'qty', 0);
    elsif v_roll < 0.30 then v_material_id := 'essence'; v_qty := 1;
    elsif v_roll < 0.60 then v_material_id := 'crystal'; v_qty := 1;
    else v_material_id := 'scrap'; v_qty := 1 + floor(random()*2)::int;        -- 1-2 statt 1-3
    end if;
  else
    -- common: 45% no-drop, 8% crystal, 47% scrap (je 1 Stück)
    if v_roll < 0.45 then
      return jsonb_build_object('material_id', null, 'qty', 0);
    elsif v_roll < 0.53 then v_material_id := 'crystal'; v_qty := 1;
    else v_material_id := 'scrap'; v_qty := 1;                                  -- 1 statt 1-2
    end if;
  end if;

  perform public.grant_material(p_user_id, v_material_id, v_qty);
  return jsonb_build_object('material_id', v_material_id, 'qty', v_qty);
end $$;

grant execute on function public.roll_material_drop(uuid, text) to authenticated, anon;
