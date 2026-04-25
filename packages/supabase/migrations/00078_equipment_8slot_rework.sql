-- ══════════════════════════════════════════════════════════════════════════
-- Equipment-Rework: 3 → 8 Slots, klassen-spezifische Items, neue Boni
-- ══════════════════════════════════════════════════════════════════════════
-- Vorher: 3 Slots (helm/armor/amulet) + Stat-Boni HP/ATK/DEF/SPD/HP_REGEN/MANA
-- Nachher:
--   8 Slots: helm, chest, legs, boots, gloves, weapon, necklace, ring
--   class_id pro Item (tank/support/ranged/melee) — nur eigene Klasse trägt
--   Neue Boni passend zu Talent-Tree-Effekten:
--     bonus_crit_pct, bonus_crit_dmg, bonus_evade_pct, bonus_rage_gen,
--     bonus_heal_on_hit, bonus_dmg_reduction, bonus_thorns_pct, bonus_pen_pct
--   Drop wird klassen-aware (im Loot-RPC).
--   128 neue Items = 8 Slots × 4 Klassen × 4 Raritäten.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Inventar + Equipment leeren (alte 3-Slot-Items unbrauchbar) ──────
do $$
declare t text;
begin
  foreach t in array array['guardian_equipment','user_items'] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('truncate table public.%I restart identity cascade', t);
    end if;
  end loop;
end $$;

delete from public.item_catalog;

-- ─── 2) Slot-Constraints erweitern ───────────────────────────────────────
alter table public.item_catalog
  drop constraint if exists item_catalog_slot_check;
alter table public.item_catalog
  add constraint item_catalog_slot_check
  check (slot in ('helm','chest','legs','boots','gloves','weapon','necklace','ring'));

alter table public.guardian_equipment
  drop constraint if exists guardian_equipment_slot_check;
alter table public.guardian_equipment
  add constraint guardian_equipment_slot_check
  check (slot in ('helm','chest','legs','boots','gloves','weapon','necklace','ring'));

-- ─── 3) Neue Spalten ─────────────────────────────────────────────────────
alter table public.item_catalog
  add column if not exists class_id            text references public.guardian_classes(id) on update cascade on delete set null,
  add column if not exists emoji_slot          text,
  add column if not exists bonus_crit_pct      numeric not null default 0,
  add column if not exists bonus_crit_dmg      numeric not null default 0,
  add column if not exists bonus_evade_pct     numeric not null default 0,
  add column if not exists bonus_rage_gen      numeric not null default 0,
  add column if not exists bonus_heal_on_hit   numeric not null default 0,
  add column if not exists bonus_dmg_reduction numeric not null default 0,
  add column if not exists bonus_thorns_pct    numeric not null default 0,
  add column if not exists bonus_pen_pct       numeric not null default 0;

create index if not exists idx_item_catalog_class on public.item_catalog(class_id);
create index if not exists idx_item_catalog_slot  on public.item_catalog(slot);

-- ─── 4) 128 Items generieren via CROSS JOIN ──────────────────────────────
-- Stat-Verteilung pro Slot (common-Baseline; Rarität multipliziert):
--   helm/chest/legs:  HP+DEF (defensiv)
--   boots:            SPD+HP (mobilität)
--   gloves:           ATK+HP (offensiv leicht)
--   weapon:           ATK+Krit/Pen (offensiv schwer)
--   necklace:         Klassen-Bonus (heal/rage/crit/thorns)
--   ring:             Utility (regen/dmg-reduction)
-- Klassen-Bonus addiert klassentypische Effekte zusätzlich auf necklace+ring+weapon.

insert into public.item_catalog
  (id, name, emoji, slot, rarity, class_id,
   bonus_hp, bonus_atk, bonus_def, bonus_spd,
   bonus_crit_pct, bonus_crit_dmg, bonus_evade_pct,
   bonus_rage_gen, bonus_heal_on_hit, bonus_dmg_reduction,
   bonus_thorns_pct, bonus_pen_pct,
   bonus_hp_regen, bonus_mana, bonus_mana_regen,
   lore)
with
slots (slot_id, slot_de, slot_emoji) as (values
  ('helm',     'Helm',         '🪖'),
  ('chest',    'Brustplatte',  '🛡️'),
  ('legs',     'Hose',         '👖'),
  ('boots',    'Stiefel',      '🥾'),
  ('gloves',   'Handschuhe',   '🧤'),
  ('weapon',   'Waffe',        '⚔️'),
  ('necklace', 'Halskette',    '📿'),
  ('ring',     'Ring',          '💍')
),
classes (cls, theme_de) as (values
  ('tank',    'Festungs'),
  ('support', 'Lichts'),
  ('ranged',  'Adler'),
  ('melee',   'Klingen')
),
rarities (rarity, rar_de, mult) as (values
  ('common',  'Gewöhnlicher', 1.0),
  ('rare',    'Seltener',     1.7),
  ('epic',    'Epischer',     2.8),
  ('legend',  'Legendärer',   4.5)
)
select
  -- id  z.B. 'helm_tank_epic'
  s.slot_id || '_' || c.cls || '_' || r.rarity                                       as id,
  -- name z.B. 'Epischer Festungs-Helm'
  r.rar_de || ' ' || c.theme_de || '-' || s.slot_de                                  as name,
  s.slot_emoji                                                                       as emoji,
  s.slot_id, r.rarity, c.cls,
  -- HP: helm/chest/legs/boots/gloves/necklace/ring tragen HP, weapon nicht
  round((case s.slot_id
    when 'helm'     then 30
    when 'chest'    then 50
    when 'legs'     then 40
    when 'boots'    then 20
    when 'gloves'   then 15
    when 'weapon'   then  0
    when 'necklace' then 20
    when 'ring'     then 15
  end) * r.mult)::int                                                                as bonus_hp,
  -- ATK: weapon/gloves/(class-melee/ranged necklace+ring)
  round((case s.slot_id
    when 'weapon'   then 25
    when 'gloves'   then 12
    when 'necklace' then case c.cls when 'melee' then 8 when 'ranged' then 8 else 0 end
    when 'ring'     then case c.cls when 'melee' then 6 when 'ranged' then 6 else 0 end
    else 0
  end) * r.mult)::int                                                                as bonus_atk,
  -- DEF: helm/chest/legs/boots, tank-bonus
  round((case s.slot_id
    when 'helm'  then 8
    when 'chest' then case c.cls when 'tank' then 22 else 15 end
    when 'legs'  then 10
    when 'boots' then 5
    else 0
  end) * r.mult)::int                                                                as bonus_def,
  -- SPD: boots primary, gloves+ring secondary
  round((case s.slot_id
    when 'boots' then case c.cls when 'melee' then 10 else 8 end
    when 'gloves'then 2
    when 'ring'  then case c.cls when 'melee' then 4 else 2 end
    else 0
  end) * r.mult)::int                                                                as bonus_spd,

  -- ─── % Boni — auf weapon/necklace/ring/gloves konzentriert ──────
  -- Krit-Chance: ranged primary
  ((case s.slot_id when 'gloves' then case c.cls when 'ranged' then 0.04 when 'melee' then 0.02 else 0 end
                   when 'necklace' then case c.cls when 'ranged' then 0.05 else 0 end
                   when 'ring'     then case c.cls when 'ranged' then 0.03 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_crit_pct,
  -- Krit-Schaden: melee primary
  ((case s.slot_id when 'weapon'   then case c.cls when 'melee' then 0.10 when 'ranged' then 0.05 else 0 end
                   when 'necklace' then case c.cls when 'melee' then 0.08 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_crit_dmg,
  -- Evade: melee secondary
  ((case s.slot_id when 'boots' then case c.cls when 'melee' then 0.04 when 'ranged' then 0.03 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_evade_pct,
  -- Rage-Gen: support primary
  ((case s.slot_id when 'necklace' then case c.cls when 'support' then 0.06 else 0 end
                   when 'ring'     then case c.cls when 'support' then 0.04 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_rage_gen,
  -- Heal-on-hit: support primary, tank secondary
  ((case s.slot_id when 'necklace' then case c.cls when 'support' then 0.04 when 'tank' then 0.02 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_heal_on_hit,
  -- Damage-Reduction: tank primary
  ((case s.slot_id when 'chest' then case c.cls when 'tank' then 0.04 else 0 end
                   when 'ring'  then case c.cls when 'tank' then 0.03 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_dmg_reduction,
  -- Thorns: tank only
  ((case s.slot_id when 'gloves' then case c.cls when 'tank' then 0.03 else 0 end
                   when 'necklace' then case c.cls when 'tank' then 0.04 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_thorns_pct,
  -- DEF-Penetration: ranged + melee
  ((case s.slot_id when 'weapon' then case c.cls when 'ranged' then 0.04 when 'melee' then 0.03 else 0 end
                   else 0 end) * r.mult)::numeric                                   as bonus_pen_pct,

  -- HP-Regen / Mana / Mana-Regen — leichter Support-Bonus, sonst 0
  round((case s.slot_id when 'ring' then case c.cls when 'support' then 5 else 0 end else 0 end) * r.mult)::int as bonus_hp_regen,
  round((case s.slot_id when 'necklace' then case c.cls when 'support' then 8 when 'ranged' then 4 else 0 end else 0 end) * r.mult)::int as bonus_mana,
  round((case s.slot_id when 'ring'     then case c.cls when 'support' then 4 when 'ranged' then 2 else 0 end else 0 end) * r.mult)::int as bonus_mana_regen,

  -- Lore (kurz)
  case c.cls
    when 'tank'    then 'Geschmiedet aus dem Stahl alter Bollwerke.'
    when 'support' then 'Eingehüllt in das warme Licht der Heiler.'
    when 'ranged'  then 'Federleicht und auf den Punkt präzise.'
    when 'melee'   then 'Klingenscharf — auf Geschwindigkeit getrimmt.'
  end                                                                                as lore
from slots s
cross join classes c
cross join rarities r;

-- ─── 5) Loot-Drop wird klassen-aware ─────────────────────────────────────
-- Equip-Items kommen jetzt nur passend zur Klasse des aktiven Wächters.
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid; v_business uuid;
  v_roll float; v_rarity text; v_xp int; v_drop_id uuid;
  v_item_id text; v_user_item_id uuid;
  v_xp_item_id text;
  v_active_class text;
begin
  select user_id, business_id into v_user, v_business from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;
  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  -- Klasse des aktiven Wächters bestimmen (für klassengebundene Item-Drops)
  select a.class_id into v_active_class
    from public.user_guardians ug
    join public.guardian_archetypes a on a.id = ug.archetype_id
   where ug.user_id = v_user and ug.is_active
   limit 1;

  v_roll := random();
  if v_roll < 0.60 then v_rarity := 'none';   v_xp := 0;
  elsif v_roll < 0.85 then v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then v_rarity := 'rare';   v_xp := 300;
  elsif v_roll < 0.99 then v_rarity := 'epic';   v_xp := 800;
  else                  v_rarity := 'legend'; v_xp := 2500; end if;

  -- 35% Chance auf XP-Elixier (rare+)
  if v_rarity in ('rare','epic','legend') and random() < 0.35 then
    v_xp_item_id := case v_rarity
      when 'rare'   then 'xp_pot_s'
      when 'epic'   then 'xp_pot_m'
      else               'xp_pot_l'
    end;
    insert into public.user_guardian_xp_items (user_id, item_id, count)
    values (v_user, v_xp_item_id, 1)
    on conflict (user_id, item_id) do update set count = public.user_guardian_xp_items.count + 1, updated_at = now();
    v_xp := 0;
  -- 40% Chance auf klassen-passendes Equip-Item (rare+ und Klasse bekannt)
  elsif v_rarity in ('rare','epic','legend') and random() < 0.40 and v_active_class is not null then
    select id into v_item_id
      from public.item_catalog
     where rarity = v_rarity and class_id = v_active_class
     order by random()
     limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source) values (v_user, v_item_id, 'drop')
      returning id into v_user_item_id;
      v_xp := 0;
    end if;
  end if;

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
    'xp_item_id', v_xp_item_id
  );
end $$;

-- ─── 6) Sanity-Check ─────────────────────────────────────────────────────
do $$
declare v_count int; v_per_class record;
begin
  select count(*) into v_count from public.item_catalog;
  if v_count <> 128 then
    raise exception 'Erwartet 128 Items nach Rework, gefunden %', v_count;
  end if;
  for v_per_class in
    select class_id, count(*) as n from public.item_catalog group by class_id order by class_id
  loop
    raise notice 'Klasse %: % Items', v_per_class.class_id, v_per_class.n;
    if v_per_class.n <> 32 then
      raise exception 'Klasse % hat % Items (erwartet 32)', v_per_class.class_id, v_per_class.n;
    end if;
  end loop;
end $$;
