-- ═══════════════════════════════════════════════════════════════════
-- Equipment-Upgrade-System + 4 Material-Typen
-- Items droppen immer grau (tier 0). Materialien upgraden: gray→green→purple→gold.
-- Jeder Upgrade-Schritt multipliziert Item-Stats (1.0 → 1.5 → 2.25 → 3.5).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Upgrade-Tier auf user_items ────────────────────────────────────
alter table public.user_items
  add column if not exists upgrade_tier int not null default 0
    check (upgrade_tier >= 0 and upgrade_tier <= 3);

-- ─── Material-Katalog (statisch) ────────────────────────────────────
create table if not exists public.material_catalog (
  id text primary key,
  name text not null,
  emoji text not null,
  description text,
  tier int not null check (tier >= 0 and tier <= 3),
  sort int not null default 0
);

insert into public.material_catalog (id, name, emoji, description, tier, sort) values
  ('scrap',    'Schrott',        '🔩', 'Rostige Reste. Grundmaterial für erste Upgrades.',        0, 10),
  ('crystal',  'Stadtkristall',  '💎', 'Verdichtete Energie aus erkundeten Gebieten.',             1, 20),
  ('essence',  'Schatten-Essenz','🔮', 'Fließende Macht aus den Dächern und Gassen.',              2, 30),
  ('relikt',   'Relikt-Splitter','✨', 'Fragmente vergessener Wächter. Treiben die Elite in Gold.',3, 40)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  tier = excluded.tier, sort = excluded.sort;

-- ─── User-Material-Inventar ─────────────────────────────────────────
create table if not exists public.user_materials (
  user_id uuid primary key references public.users(id) on delete cascade,
  scrap int not null default 0 check (scrap >= 0),
  crystal int not null default 0 check (crystal >= 0),
  essence int not null default 0 check (essence >= 0),
  relikt int not null default 0 check (relikt >= 0),
  updated_at timestamptz not null default now()
);

alter table public.material_catalog enable row level security;
alter table public.user_materials   enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='material_catalog' and policyname='mat_public_read') then
    create policy mat_public_read on public.material_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_materials' and policyname='mat_self_read') then
    create policy mat_self_read on public.user_materials for select using (user_id = auth.uid());
  end if;
end $$;

-- ─── Helper: Material gutschreiben ──────────────────────────────────
create or replace function public.grant_material(p_user_id uuid, p_material_id text, p_qty int)
returns void language plpgsql security definer as $$
begin
  insert into public.user_materials (user_id) values (p_user_id) on conflict (user_id) do nothing;
  if    p_material_id = 'scrap'   then update public.user_materials set scrap   = scrap   + p_qty, updated_at = now() where user_id = p_user_id;
  elsif p_material_id = 'crystal' then update public.user_materials set crystal = crystal + p_qty, updated_at = now() where user_id = p_user_id;
  elsif p_material_id = 'essence' then update public.user_materials set essence = essence + p_qty, updated_at = now() where user_id = p_user_id;
  elsif p_material_id = 'relikt'  then update public.user_materials set relikt  = relikt  + p_qty, updated_at = now() where user_id = p_user_id;
  end if;
end $$;

-- ─── Zufälliges Material droppen (skaliert mit Kontext-Rarity) ──────
-- Returns den ge-droppten Material-Eintrag als jsonb, oder null wenn kein Drop.
create or replace function public.roll_material_drop(p_user_id uuid, p_context_rarity text)
returns jsonb language plpgsql security definer as $$
declare
  v_roll float;
  v_material_id text;
  v_qty int := 1;
begin
  v_roll := random();
  -- Kontext-abhängige Drop-Wahrscheinlichkeit
  if p_context_rarity = 'legendary' then
    if v_roll < 0.10 then v_material_id := 'relikt';
    elsif v_roll < 0.45 then v_material_id := 'essence'; v_qty := 1 + floor(random()*2)::int;
    else v_material_id := 'crystal'; v_qty := 2 + floor(random()*3)::int;
    end if;
  elsif p_context_rarity = 'epic' then
    if v_roll < 0.03 then v_material_id := 'relikt';
    elsif v_roll < 0.25 then v_material_id := 'essence';
    elsif v_roll < 0.70 then v_material_id := 'crystal'; v_qty := 1 + floor(random()*2)::int;
    else v_material_id := 'scrap'; v_qty := 2 + floor(random()*3)::int;
    end if;
  elsif p_context_rarity = 'rare' then
    if v_roll < 0.08 then v_material_id := 'essence';
    elsif v_roll < 0.45 then v_material_id := 'crystal';
    else v_material_id := 'scrap'; v_qty := 1 + floor(random()*3)::int;
    end if;
  else  -- common
    if v_roll < 0.15 then v_material_id := 'crystal';
    else v_material_id := 'scrap'; v_qty := 1 + floor(random()*2)::int;
    end if;
  end if;

  perform public.grant_material(p_user_id, v_material_id, v_qty);

  return jsonb_build_object('material_id', v_material_id, 'qty', v_qty);
end $$;

-- ─── Upgrade-Kosten pro Tier ────────────────────────────────────────
-- Tier 0→1: 8× scrap
-- Tier 1→2: 6× crystal + 2× scrap
-- Tier 2→3: 5× essence + 3× crystal
-- (Tier 3 = gold, max)
create or replace function public.upgrade_cost(p_current_tier int)
returns jsonb language sql immutable as $$
  select case p_current_tier
    when 0 then jsonb_build_object('scrap', 8)
    when 1 then jsonb_build_object('scrap', 2, 'crystal', 6)
    when 2 then jsonb_build_object('crystal', 3, 'essence', 5)
    else null  -- max
  end;
$$;

-- ─── Item upgraden ──────────────────────────────────────────────────
create or replace function public.upgrade_item(p_user_item_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_owner uuid;
  v_current_tier int;
  v_cost jsonb;
  v_scrap int := 0; v_crystal int := 0; v_essence int := 0; v_relikt int := 0;
  v_have_scrap int; v_have_crystal int; v_have_essence int; v_have_relikt int;
begin
  select user_id, upgrade_tier into v_owner, v_current_tier
    from public.user_items where id = p_user_item_id;
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_owner <> auth.uid() then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  if v_current_tier >= 3 then return jsonb_build_object('ok', false, 'error', 'already_maxed'); end if;

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

  update public.user_items set upgrade_tier = v_current_tier + 1 where id = p_user_item_id;

  return jsonb_build_object('ok', true, 'new_tier', v_current_tier + 1);
end $$;

grant execute on function public.grant_material(uuid, text, int) to authenticated, anon;
grant execute on function public.roll_material_drop(uuid, text) to authenticated, anon;
grant execute on function public.upgrade_cost(int) to authenticated, anon;
grant execute on function public.upgrade_item(uuid) to authenticated;

-- ─── Existierende Loot-RPCs mit Material-Drop erweitern ─────────────

-- award_redemption_loot: Bei Common-Roll oder "none" trotzdem Material fallen lassen
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid; v_business uuid;
  v_roll float; v_rarity text; v_xp int; v_drop_id uuid;
  v_item_id text; v_user_item_id uuid;
  v_material jsonb;
begin
  select user_id, business_id into v_user, v_business from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;
  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  v_roll := random();
  if v_roll < 0.60 then v_rarity := 'none'; v_xp := 0;
  elsif v_roll < 0.85 then v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then v_rarity := 'rare'; v_xp := 300;
  elsif v_roll < 0.99 then v_rarity := 'epic'; v_xp := 800;
  else v_rarity := 'legend'; v_xp := 2500; end if;

  -- Item drop: immer "grau" (upgrade_tier = 0)
  if v_rarity in ('rare','epic','legend') and random() < 0.40 then
    select id into v_item_id from public.item_catalog where rarity = v_rarity order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source, upgrade_tier)
        values (v_user, v_item_id, 'drop', 0) returning id into v_user_item_id;
      v_xp := 0;
    end if;
  end if;

  -- Material-Drop (immer: auch bei "none"-Roll)
  v_material := public.roll_material_drop(v_user, case when v_rarity = 'none' then 'common' else v_rarity end);

  insert into public.guardian_drops (user_id, redemption_id, business_id, rarity, xp_awarded)
  values (v_user, p_redemption_id, v_business, v_rarity, v_xp)
  returning id into v_drop_id;

  update public.deal_redemptions set loot_rarity = v_rarity, loot_xp = v_xp where id = p_redemption_id;
  if v_xp > 0 then
    update public.user_guardians set xp = xp + v_xp where user_id = v_user and is_active;
  end if;

  return jsonb_build_object(
    'id', v_drop_id, 'rarity', v_rarity, 'xp_awarded', v_xp,
    'item_id', v_item_id, 'user_item_id', v_user_item_id,
    'material', v_material
  );
end $$;

-- grant_receipt_bonus_loot: Material basierend auf Bonus-Rarity
create or replace function public.grant_receipt_bonus_loot(
  p_redemption_id uuid,
  p_amount_cents int,
  p_verified boolean
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_existing text;
  v_rarity text;
  v_bonus_universal int := 0;
  v_bonus_typed int := 0;
  v_typed_rarity text := 'common';
  v_item_id text;
  v_user_item_id uuid;
  v_amount int;
  v_col int;
  v_material jsonb;
begin
  select user_id, receipt_bonus_rarity into v_user, v_existing
    from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'redemption_not_found');
  end if;
  if v_existing is not null and v_existing <> 'none' then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  v_amount := coalesce(p_amount_cents, 0);
  if not p_verified then v_amount := v_amount / 2; end if;

  if v_amount >= 15000 then
    v_rarity := 'legendary'; v_bonus_typed := 2; v_typed_rarity := 'epic';
    if random() < 0.20 then v_typed_rarity := 'legendary'; end if;
  elsif v_amount >= 5000 then
    v_rarity := 'epic'; v_bonus_typed := 2; v_typed_rarity := 'rare';
    if random() < 0.25 then v_typed_rarity := 'epic'; end if;
  elsif v_amount >= 1500 then
    v_rarity := 'rare'; v_bonus_typed := 1; v_typed_rarity := 'rare';
    v_bonus_universal := 1;
  elsif v_amount >= 500 then
    v_rarity := 'common'; v_bonus_universal := 2;
  elsif v_amount >= 100 then
    v_rarity := 'common'; v_bonus_universal := 1;
  else
    v_rarity := 'none';
  end if;

  if v_bonus_universal > 0 or v_bonus_typed > 0 then
    insert into public.user_siegel (user_id) values (v_user) on conflict (user_id) do nothing;
    if v_bonus_universal > 0 then
      update public.user_siegel set siegel_universal = siegel_universal + v_bonus_universal, updated_at = now() where user_id = v_user;
    end if;
    if v_bonus_typed > 0 then
      v_col := floor(random()*4)::int;
      if v_col = 0 then
        update public.user_siegel set siegel_infantry = siegel_infantry + v_bonus_typed, updated_at = now() where user_id = v_user;
      elsif v_col = 1 then
        update public.user_siegel set siegel_cavalry  = siegel_cavalry  + v_bonus_typed, updated_at = now() where user_id = v_user;
      elsif v_col = 2 then
        update public.user_siegel set siegel_marksman = siegel_marksman + v_bonus_typed, updated_at = now() where user_id = v_user;
      else
        update public.user_siegel set siegel_mage     = siegel_mage     + v_bonus_typed, updated_at = now() where user_id = v_user;
      end if;
    end if;
  end if;

  -- Item-Drop (immer grau)
  if v_rarity in ('epic','legendary') then
    select id into v_item_id from public.item_catalog
      where rarity = case when v_rarity = 'legendary' then 'legend' else 'epic' end
      order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source, upgrade_tier)
        values (v_user, v_item_id, 'drop', 0) returning id into v_user_item_id;
    end if;
  end if;

  -- Material-Drop (rarity-abhängig)
  if v_rarity <> 'none' then
    v_material := public.roll_material_drop(v_user, v_rarity);
  end if;

  update public.deal_redemptions
    set receipt_bonus_rarity = v_rarity,
        purchase_amount_cents = p_amount_cents,
        receipt_verified = p_verified,
        receipt_submitted_at = now()
    where id = p_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'rarity', v_rarity,
    'bonus_universal', v_bonus_universal,
    'bonus_typed', v_bonus_typed,
    'typed_rarity', v_typed_rarity,
    'item_id', v_item_id,
    'user_item_id', v_user_item_id,
    'material', v_material
  );
end $$;

