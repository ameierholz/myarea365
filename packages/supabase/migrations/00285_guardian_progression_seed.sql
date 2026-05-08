-- ════════════════════════════════════════════════════════════════════════
-- BEGLEITER-PROGRESSION DATEN-SEED
-- Schema (talent_nodes/archetype_skills) + RPCs (spend_talent_point/upgrade_skill)
-- existieren seit längerem (siehe 00076 etc.). Tabellen waren leer; UI war tot.
--
-- Seed:
--   • talent_nodes: 24 Nodes pro Archetype × 9 = 216 Rows
--     Branches: primary / secondary / utility (passend zu UI in guardian-talent-tree.tsx)
--   • archetype_skills: 4 Slots pro Archetype × 9 = 36 Rows
--     Slots: active / passive_1 / passive_2 / expertise
--
-- Effekt-Keys folgen EFFECT_KEY_MAP in guardian-talent-tree.tsx, sodass die UI
-- die Werte ohne Code-Änderung formatieren kann.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) talent_nodes Seed ────────────────────────────────────────────────
-- Generic Template das pro Archetype kopiert wird. Counter-Role-Modifier
-- (vs_<role>) wird je nach Archetype-Type angepasst.
do $$
declare
  v_arch record;
  v_counter_role text;
  v_id_prefix text;
begin
  for v_arch in
    select id, guardian_type from public.guardian_archetypes
  loop
    -- Counter-Role: was schlägt diese Klasse hart? (Klassisches Schere-Stein-Papier)
    --   infantry → cavalry (Pikeniere stoppen Reiter)
    --   cavalry  → marksman (Reiter rennen Schützen über)
    --   marksman → infantry (Pfeile schreddern Fußvolk)
    --   mage     → infantry (AoE gegen Gruppen)
    v_counter_role := case v_arch.guardian_type
      when 'infantry' then 'cavalry'
      when 'cavalry'  then 'marksman'
      when 'marksman' then 'infantry'
      when 'mage'     then 'infantry'
      else 'infantry'
    end;
    v_id_prefix := v_arch.id;

    -- ════ PRIMARY BRANCH (Offensive) ════
    insert into public.talent_nodes
      (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
    values
      -- Tier 1
      (v_id_prefix || '_p_t1_a', v_arch.id, 'primary', 1, 1, 'Schlagkraft',     'Erhöht Angriff dieser Begleiter-Klasse.', 5, 'atk_pct',  0.02, null),
      (v_id_prefix || '_p_t1_b', v_arch.id, 'primary', 1, 2, 'Trefferquote',    'Erhöht Crit-Chance um wenige Prozent pro Rang.', 5, 'crit_pct', 0.015, null),
      -- Tier 2 (requires Tier 1)
      (v_id_prefix || '_p_t2_a', v_arch.id, 'primary', 2, 1, 'Wuchtschlag',     'Erhöht Crit-Damage massiv.', 5, 'crit_dmg', 0.05, v_id_prefix || '_p_t1_a'),
      (v_id_prefix || '_p_t2_b', v_arch.id, 'primary', 2, 2, 'Skillverstärker', 'Erhöht Schaden aktiver Skills.', 5, 'skill_dmg', 0.04, v_id_prefix || '_p_t1_b'),
      -- Tier 3 (requires Tier 2)
      (v_id_prefix || '_p_t3_a', v_arch.id, 'primary', 3, 1, 'Counter-Spec',    format('Mehr Schaden gegen %s-Truppen.', v_counter_role), 5, 'vs_' || v_counter_role, 0.05, v_id_prefix || '_p_t2_a'),
      (v_id_prefix || '_p_t3_b', v_arch.id, 'primary', 3, 2, 'Eröffnung',       'Mehr Schaden in der ersten Runde des Kampfes.', 5, 'r1_atk_pct', 0.06, v_id_prefix || '_p_t2_b'),
      -- Tier 4 (requires Tier 3) — Keystones
      (v_id_prefix || '_p_t4_a', v_arch.id, 'primary', 4, 1, 'Allmacht',        'Erhöht ALLE Stats.', 3, 'all_stats_pct', 0.02, v_id_prefix || '_p_t3_a'),
      (v_id_prefix || '_p_t4_b', v_arch.id, 'primary', 4, 2, 'Berserker-Eid',   'Bei <30% HP: erhöhter Angriff (Keystone).', 1, 'berserker_key', 1, v_id_prefix || '_p_t3_b')
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      max_rank = excluded.max_rank, effect_key = excluded.effect_key,
      effect_per_rank = excluded.effect_per_rank, requires_node_id = excluded.requires_node_id;

    -- ════ SECONDARY BRANCH (Defense) ════
    insert into public.talent_nodes
      (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
    values
      (v_id_prefix || '_s_t1_a', v_arch.id, 'secondary', 1, 1, 'Härte',         'Erhöht max. HP.', 5, 'hp_pct', 0.02, null),
      (v_id_prefix || '_s_t1_b', v_arch.id, 'secondary', 1, 2, 'Panzerung',     'Erhöht Verteidigung.', 5, 'def_pct', 0.02, null),
      (v_id_prefix || '_s_t2_a', v_arch.id, 'secondary', 2, 1, 'Zähigkeit',     'Reduziert eingehenden Schaden.', 5, 'dmg_reduction', 0.015, v_id_prefix || '_s_t1_a'),
      (v_id_prefix || '_s_t2_b', v_arch.id, 'secondary', 2, 2, 'Regeneration',  'Heilt pro Runde.', 5, 'regen_pct', 0.015, v_id_prefix || '_s_t1_b'),
      (v_id_prefix || '_s_t3_a', v_arch.id, 'secondary', 3, 1, 'Dornen',        'Reflektiert Schaden auf Angreifer.', 5, 'thorns_pct', 0.025, v_id_prefix || '_s_t2_a'),
      (v_id_prefix || '_s_t3_b', v_arch.id, 'secondary', 3, 2, 'Lebensraub',    'Heilt bei jedem Treffer.', 5, 'heal_on_hit', 0.02, v_id_prefix || '_s_t2_b'),
      (v_id_prefix || '_s_t4_a', v_arch.id, 'secondary', 4, 1, 'Stahlnerven',   'Reduziert Stun-Wirkung.', 3, 'stun_resist', 0.10, v_id_prefix || '_s_t3_a'),
      (v_id_prefix || '_s_t4_b', v_arch.id, 'secondary', 4, 2, 'Bollwerk',      'Endgame-Schild (Keystone).', 1, 'bollwerk_key', 1, v_id_prefix || '_s_t3_b')
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      max_rank = excluded.max_rank, effect_key = excluded.effect_key,
      effect_per_rank = excluded.effect_per_rank, requires_node_id = excluded.requires_node_id;

    -- ════ UTILITY BRANCH (Mobility / Skills / Endgame) ════
    insert into public.talent_nodes
      (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
    values
      (v_id_prefix || '_u_t1_a', v_arch.id, 'utility', 1, 1, 'Geschwindigkeit', 'Erhöht Geschwindigkeit (Marsch + Initiative).', 5, 'spd_pct', 0.02, null),
      (v_id_prefix || '_u_t1_b', v_arch.id, 'utility', 1, 2, 'Wut-Generator',   'Generiert mehr Rage pro Hit.', 5, 'rage_gen', 0.04, null),
      (v_id_prefix || '_u_t2_a', v_arch.id, 'utility', 2, 1, 'Ausweichen',      'Erhöht Evade-Chance.', 5, 'evade_pct', 0.015, v_id_prefix || '_u_t1_a'),
      (v_id_prefix || '_u_t2_b', v_arch.id, 'utility', 2, 2, 'Konter',          'Konter-Schlag-Chance.', 5, 'counter_pct', 0.02, v_id_prefix || '_u_t1_b'),
      (v_id_prefix || '_u_t3_a', v_arch.id, 'utility', 3, 1, 'Reinigung',       'Entfernt Debuff-Stacks.', 3, 'debuff_cleanse', 0.10, v_id_prefix || '_u_t2_a'),
      (v_id_prefix || '_u_t3_b', v_arch.id, 'utility', 3, 2, 'Spätzünder',      'Mehr Schaden in späten Kampfrunden.', 5, 'late_atk', 0.04, v_id_prefix || '_u_t2_b'),
      (v_id_prefix || '_u_t4_a', v_arch.id, 'utility', 4, 1, 'Erweckung',       'Endgame-Awakening (Keystone).', 1, 'awaken_key', 1, v_id_prefix || '_u_t3_a'),
      (v_id_prefix || '_u_t4_b', v_arch.id, 'utility', 4, 2, 'Symbiose',        'Crew-Synergie-Boost (Keystone).', 1, 'symbiose_key', 1, v_id_prefix || '_u_t3_b')
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      max_rank = excluded.max_rank, effect_key = excluded.effect_key,
      effect_per_rank = excluded.effect_per_rank, requires_node_id = excluded.requires_node_id;
  end loop;
end $$;

-- ─── 2) archetype_skills Seed ────────────────────────────────────────────
-- 5 Slots laut SKILL_SLOT_META in lib/guardian.ts:
--   active / passive / combat / role / expertise
-- 4 Nicht-Expertise Slots werden alle gleichzeitig gemaxxt → Expertise unlock.
do $$
declare
  v_arch record;
begin
  for v_arch in
    select id, ability_id, ability_name, ability_desc, guardian_type, role
    from public.guardian_archetypes
  loop
    -- ACTIVE: aus ability_id kopiert
    insert into public.archetype_skills
      (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
    values (
      v_arch.id || '_active',
      v_arch.id, 'active',
      coalesce(v_arch.ability_name, 'Aktiv-Skill'),
      coalesce(v_arch.ability_desc, 'Hauptaktion des Begleiters.'),
      coalesce(v_arch.ability_id, 'active_strike'),
      100, 25, 300
    )
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      effect_key = excluded.effect_key, base_value = excluded.base_value,
      per_level_value = excluded.per_level_value, rage_cost = excluded.rage_cost;

    -- PASSIVE: Klassen-Passiv (allgemein)
    insert into public.archetype_skills
      (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
    values (
      v_arch.id || '_passive',
      v_arch.id, 'passive',
      case v_arch.guardian_type
        when 'infantry' then 'Sturmgeist'
        when 'cavalry'  then 'Charge-Drift'
        when 'marksman' then 'Adlerblick'
        when 'mage'     then 'Arkan-Fluss'
        else 'Kampfeswille'
      end,
      'Passiver Bonus auf Klassen-Hauptstat.',
      case v_arch.guardian_type
        when 'infantry' then 'def_pct'
        when 'cavalry'  then 'spd_pct'
        when 'marksman' then 'crit_pct'
        when 'mage'     then 'skill_dmg'
        else 'atk_pct'
      end,
      0.03, 0.015, 0
    )
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      effect_key = excluded.effect_key, base_value = excluded.base_value,
      per_level_value = excluded.per_level_value;

    -- COMBAT: kampf-bezogener Modifier (klassen-orthogonal)
    insert into public.archetype_skills
      (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
    values (
      v_arch.id || '_combat',
      v_arch.id, 'combat',
      'Kampfreflex',
      'Verstärkt Kampf-Trigger (Crit/Konter/Wut).',
      case v_arch.guardian_type
        when 'infantry' then 'thorns_pct'
        when 'cavalry'  then 'r1_atk_pct'
        when 'marksman' then 'crit_dmg'
        when 'mage'     then 'rage_gen'
        else 'counter_pct'
      end,
      0.03, 0.02, 0
    )
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      effect_key = excluded.effect_key, base_value = excluded.base_value,
      per_level_value = excluded.per_level_value;

    -- ROLE: rolle-themenspezifisch (Tank/Heiler/etc.)
    insert into public.archetype_skills
      (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
    values (
      v_arch.id || '_role',
      v_arch.id, 'role',
      case v_arch.role
        when 'tank'        then 'Schildwall'
        when 'krieger'     then 'Disziplin'
        when 'kleriker'    then 'Heilig-Aura'
        when 'bogenschuetze' then 'Präzision'
        when 'ritter'      then 'Reitkunst'
        when 'support'     then 'Beuteinstinkt'
        when 'magier'      then 'Mana-Bank'
        when 'berserker'   then 'Blutrausch'
        when 'priester'    then 'Lebenstanz'
        else 'Treue'
      end,
      'Rollen-Passiv abhängig vom Begleiter-Typ.',
      case v_arch.role
        when 'tank'        then 'hp_pct'
        when 'krieger'     then 'dmg_reduction'
        when 'kleriker'    then 'heal_on_hit'
        when 'bogenschuetze' then 'evade_pct'
        when 'ritter'      then 'spd_pct'
        when 'support'     then 'late_atk'
        when 'magier'      then 'skill_dmg'
        when 'berserker'   then 'atk_pct'
        when 'priester'    then 'regen_pct'
        else 'all_stats_pct'
      end,
      0.04, 0.02, 0
    )
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      effect_key = excluded.effect_key, base_value = excluded.base_value,
      per_level_value = excluded.per_level_value;

    -- EXPERTISE: Endgame, alle 4 anderen Lv5
    insert into public.archetype_skills
      (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
    values (
      v_arch.id || '_expertise',
      v_arch.id, 'expertise',
      'Meisterschaft',
      'Endgame-Bonus auf alle Stats. Schaltet frei wenn alle 4 anderen Skills Lv5 sind. Kostet 2× Siegel.',
      'all_stats_pct',
      0.05, 0.03, 0
    )
    on conflict (id) do update set
      name = excluded.name, description = excluded.description,
      effect_key = excluded.effect_key, base_value = excluded.base_value,
      per_level_value = excluded.per_level_value;
  end loop;
end $$;

-- ─── 3) upgrade_skill bleibt unverändert (existing prüft 4 nicht-expertise Slots,
--       passt zum Seed: active/passive/combat/role + expertise = 4 + 1)

-- ─── 4) Fix: apply_guardian_xp_item levelt jetzt korrekt ───────────────
-- Vorher: addierte rohes XP via UPDATE xp += N → niemals Level-Up.
-- Jetzt: ruft apply_guardian_xp damit Level + talent_points_available steigen.
create or replace function public.apply_guardian_xp_item(p_item_id text, p_guardian_id uuid, p_count integer default 1)
returns jsonb language plpgsql security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_user uuid := auth.uid();
  v_have int; v_xp_each int; v_xp_total int; v_owner uuid; v_apply jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_count is null or p_count < 1 then return jsonb_build_object('ok', false, 'error', 'bad_count'); end if;
  select user_id into v_owner from public.user_guardians where id = p_guardian_id;
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'guardian_not_found'); end if;
  if v_owner <> v_user then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;
  select xp_amount into v_xp_each from public.guardian_xp_items where id = p_item_id;
  if v_xp_each is null then return jsonb_build_object('ok', false, 'error', 'item_not_found'); end if;
  select count into v_have from public.user_guardian_xp_items where user_id = v_user and item_id = p_item_id;
  if coalesce(v_have, 0) < p_count then
    return jsonb_build_object('ok', false, 'error', 'not_enough', 'have', coalesce(v_have, 0));
  end if;
  v_xp_total := v_xp_each * p_count;
  update public.user_guardian_xp_items set count = count - p_count, updated_at = now()
   where user_id = v_user and item_id = p_item_id;
  v_apply := public.apply_guardian_xp(p_guardian_id, v_xp_total);
  return jsonb_build_object('ok', true, 'xp_added', v_xp_total, 'item_id', p_item_id,
    'guardian_id', p_guardian_id, 'level', v_apply->>'level',
    'levels_gained', v_apply->>'levels_gained', 'faction_buff', v_apply->>'faction_buff');
end $fn$;
grant execute on function public.apply_guardian_xp_item(text, uuid, int) to authenticated;

-- ─── 5) Trigger: alle XP-Quellen auto-leveln (Sicherheitsnetz) ────────
-- Mehrere RPCs (runner_fight_settle, train_at_sanctuary, award_redemption_loot,
-- grant_territory_lord_bonus, match_shop_quests) addieren rohes XP via
-- UPDATE user_guardians SET xp = xp + N. Der Trigger normalisiert das damit
-- Level + talent_points_available immer korrekt nachgezogen werden.
create or replace function public._on_user_guardian_xp_change()
returns trigger language plpgsql security definer as $fn$
declare
  v_xp bigint; v_level int; v_need int; v_levels_gained int := 0;
begin
  if (tg_op = 'UPDATE' and new.xp <= coalesce(old.xp, 0)) then return new; end if;
  v_xp := new.xp; v_level := new.level;
  while v_level < 60 loop
    v_need := round(100 * power(v_level, 1.6));
    exit when v_xp < v_need;
    v_xp := v_xp - v_need;
    v_level := v_level + 1;
    v_levels_gained := v_levels_gained + 1;
  end loop;
  if v_levels_gained > 0 then
    new.xp := v_xp; new.level := v_level;
    new.talent_points_available := coalesce(new.talent_points_available, 0) + v_levels_gained;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_user_guardian_xp_change on public.user_guardians;
create trigger trg_user_guardian_xp_change
  before update of xp on public.user_guardians
  for each row execute procedure public._on_user_guardian_xp_change();
