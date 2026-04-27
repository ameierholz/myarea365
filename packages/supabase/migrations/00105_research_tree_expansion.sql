-- ══════════════════════════════════════════════════════════════════════════
-- FORSCHUNGSBAUM-EXPANSION (CoD-Style Tiefenausbau)
-- ══════════════════════════════════════════════════════════════════════════
-- Erweitert 00097 + 00102 um ~25 Researches:
-- · Economy: pro Resource Bau+Verarbeitung, Architektur, Stipendium-Hub,
--   Schwachpunkte, Edelstein-Exploration, Schlaraffenland (Tier-3 Endgame)
-- · Military: 4 Class-Defense-Buffs (-schutz), 4 Class-HP-Buffs,
--   Pfadfinden-Hub (March-Speed), Erste-Hilfe (Heal), Abwehrformation,
--   Angriffsstrategie, Himmlische (Rare Crit)
-- · Infrastructure: Architektur II, Verbesserte Container
-- · Social: Gilden-Bonus, Inspiration II
-- ══════════════════════════════════════════════════════════════════════════

insert into public.research_definitions
  (id, name, emoji, description, branch, tier, prereq_id, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_time_minutes, buildtime_growth, effect_key, effect_per_level,
   required_burg_level, sort)
values
  -- ═══════════════════════ ECONOMY EXPANSION ═══════════════════════
  ('eco_manaernte', 'Mana-Ernte', '💧', '+5% Mana-Produktion pro Stufe.', 'economy', 1, null, 10,
    100, 80, 30, 0, 30, 1.45, 'mana_production_pct', 0.05, 1, 5),

  ('eco_forstwirtschaft', 'Forstwirtschaft', '🌲', '+8% Holz pro Stufe (Tier 2).', 'economy', 2, 'eco_holzfaeller', 10,
    300, 200, 80, 0, 90, 1.50, 'wood_production_pct', 0.08, 4, 40),

  ('eco_goldverarbeitung', 'Goldverarbeitung', '🥇', '+8% Gold pro Stufe (Tier 2).', 'economy', 2, 'eco_handel', 10,
    250, 250, 200, 0, 120, 1.50, 'gold_production_pct', 0.08, 4, 41),

  ('eco_eisenbearbeitung', 'Eisenbearbeitung', '⛏️', '+8% Stein pro Stufe (Tier 2).', 'economy', 2, 'eco_steinbruch', 10,
    200, 350, 80, 0, 90, 1.50, 'stone_production_pct', 0.08, 4, 42),

  ('eco_architektur', 'Architektur', '🏛️', '+10% Lager-Cap pro Stufe (Tier 2).', 'economy', 2, 'eco_lager', 10,
    300, 400, 100, 30, 120, 1.50, 'storage_cap_pct', 0.10, 5, 43),

  ('eco_stipendium', 'Stipendium', '📜', '+3% Forschungsspeed pro Stufe — gates Tier 3.', 'economy', 2, null, 5,
    400, 400, 200, 50, 240, 1.55, 'research_speed_pct', 0.03, 6, 44),

  ('eco_schwachpunkte', 'Schwachpunkte', '🎯', '+5% Resource-Gather-Speed (außer Lauf-Drops).', 'economy', 3, 'eco_stipendium', 10,
    500, 500, 250, 80, 360, 1.55, 'gather_speed_pct', 0.05, 7, 50),

  ('eco_edelstein', 'Edelstein-Exploration', '💎', 'Schaltet seltene Edelstein-Drops aus Truhen frei.', 'economy', 3, 'eco_stipendium', 1,
    800, 800, 500, 150, 600, 1.0, 'unlock_gem_drops', 1, 8, 51),

  ('eco_lieferketten', 'Lieferketten', '🚚', '+5% Crew-Resource-Donation-Bonus.', 'economy', 3, 'eco_architektur', 10,
    400, 600, 200, 50, 300, 1.55, 'crew_donate_bonus_pct', 0.05, 7, 52),

  ('eco_schlaraffenland', 'Schlaraffenland', '🏆', '+3% ALLE Resourcen pro Stufe (Endgame).', 'economy', 3, 'eco_schwachpunkte', 10,
    1500, 1500, 800, 200, 720, 1.60, 'all_resources_pct', 0.03, 10, 53),

  -- ═══════════════════════ MILITARY EXPANSION ═══════════════════════

  -- Vierte Klasse Tier-1 (Magie-Studium)
  ('mil_magie', 'Magie-Studium', '🔮', '+3% Belagerungs/Magie-Atk pro Stufe.', 'military', 1, null, 10,
    100, 100, 60, 30, 50, 1.50, 'siege_atk_pct', 0.03, 4, 14),

  -- Class-DEF (4 Schutz-Researches, prereq jeweils auf class atk)
  ('mil_infanterieschutz', 'Infanterie-Schutz', '🛡️', '+4% Infanterie-DEF pro Stufe.', 'military', 1, 'mil_infanterie', 10,
    150, 200, 50, 0, 60, 1.50, 'infantry_def_pct', 0.04, 3, 60),
  ('mil_kavallerieschutz', 'Kavallerie-Schutz', '🛡️', '+4% Kavallerie-DEF pro Stufe.', 'military', 1, 'mil_reiterei', 10,
    150, 200, 70, 0, 60, 1.50, 'cavalry_def_pct', 0.04, 4, 61),
  ('mil_schuetzenschutz', 'Schützen-Schutz', '🛡️', '+4% Schützen-DEF pro Stufe.', 'military', 1, 'mil_schiesskunst', 10,
    150, 200, 60, 0, 60, 1.50, 'marksman_def_pct', 0.04, 5, 62),
  ('mil_magieschutz', 'Magischer Schutz', '🛡️', '+4% Belagerungs/Magie-DEF pro Stufe.', 'military', 1, 'mil_magie', 10,
    150, 200, 70, 30, 60, 1.50, 'siege_def_pct', 0.04, 5, 63),

  -- Pfadfinden-Hub (March-Speed, gates Tier-3 military)
  ('mil_pfadfinden', 'Pfadfinden', '🗺️', '+2% March-Speed pro Stufe.', 'military', 2, 'mil_tactical', 10,
    300, 300, 200, 50, 180, 1.50, 'march_speed_pct', 0.02, 6, 70),

  -- Tier-3 military: Heal, Defense-Formation, Attack-Strategy
  ('mil_erste_hilfe', 'Erste Hilfe', '➕', '+5% Truppen werden nach Kampf statt verloren geheilt.', 'military', 3, 'mil_pfadfinden', 10,
    400, 400, 200, 80, 240, 1.55, 'troop_heal_pct', 0.05, 7, 71),

  ('mil_abwehrformation', 'Abwehrformation', '🛡️', '+3% Truppen-DEF wenn deine Base verteidigt wird.', 'military', 3, 'mil_pfadfinden', 10,
    500, 500, 200, 50, 300, 1.55, 'garrison_def_pct', 0.03, 7, 72),

  ('mil_angriffsstrategie', 'Angriffsstrategie', '⚔️', '+3% Truppen-ATK auf Marsch (Solo/Crew-Attacks).', 'military', 3, 'mil_pfadfinden', 10,
    500, 500, 250, 50, 300, 1.55, 'march_atk_pct', 0.03, 7, 73),

  ('mil_himmlische', 'Himmlische Taktik', '✨', 'Schaltet 5% Crit-Chance auf Truppen-Skills frei.', 'military', 4, 'mil_angriffsstrategie', 1,
    1500, 1500, 800, 300, 1440, 1.0, 'unlock_troop_crit', 1, 12, 74),

  -- ═══════════════════════ INFRASTRUCTURE EXPANSION ═══════════════════════

  ('inf_architektur', 'Architektur II', '🏗️', '−4% Bauzeit pro Stufe (Tier 2).', 'infrastructure', 2, 'inf_baumeister', 10,
    300, 300, 100, 0, 120, 1.55, 'build_time_pct', 0.04, 6, 22),

  ('inf_container', 'Verbesserte Container', '📦', '+8% Lager-Cap pro Stufe (Tier 2).', 'infrastructure', 2, 'inf_logistik', 10,
    300, 400, 80, 0, 120, 1.55, 'storage_cap_pct', 0.08, 6, 23),

  -- ═══════════════════════ SOCIAL EXPANSION ═══════════════════════

  ('soc_gildenbonus', 'Gilden-Bonus', '🎖️', '+5% Crew-XP pro Stufe.', 'social', 2, 'soc_diplomatie', 10,
    200, 200, 200, 30, 90, 1.50, 'crew_xp_pct', 0.05, 5, 32),

  ('soc_inspiration_2', 'Inspiration II', '🌟', '+5% Wächter-ATK pro Stufe.', 'social', 2, 'soc_inspiration', 10,
    200, 200, 150, 50, 90, 1.50, 'guardian_atk_pct', 0.05, 6, 33),

  ('soc_gemeinschaft', 'Gemeinschaftsgeist', '🤲', '+3% Crew-Bau-Speed pro Stufe.', 'social', 3, 'soc_gildenbonus', 10,
    400, 400, 300, 100, 240, 1.55, 'crew_build_speed_pct', 0.03, 8, 34)

on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  branch = excluded.branch, tier = excluded.tier, prereq_id = excluded.prereq_id,
  max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_time_minutes = excluded.base_time_minutes, buildtime_growth = excluded.buildtime_growth,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_burg_level = excluded.required_burg_level, sort = excluded.sort;
