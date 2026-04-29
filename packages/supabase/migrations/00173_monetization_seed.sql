-- ══════════════════════════════════════════════════════════════════════════
-- Monetization Seed-Daten — initiale Deals für alle 7 Kategorien
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Saisonales Pack: aktuell "Wegemünzen-Frühling" ───────────────────
insert into public.monetization_seasonal_packs (id, title, subtitle, description, hero_image, starts_at, ends_at, price_cents, bonus_gems, rewards, active) values
('seasonal_2026_spring',
 'Wegemünzen-Frühling',
 'Spüre die Magie der Stadt!',
 'Erhalte sofort 1.250 Edelsteine und Bonus-Goodies im Wert von über 30.000 Edelsteinen.',
 null,
 '2026-04-01T00:00:00Z',
 '2026-06-30T23:59:59Z',
 499,
 1250,
 '[
   {"kind":"egg","tier":"epic","qty":1,"label":"Saisonal-Wächter-Ei (epic)"},
   {"kind":"speedup_60","qty":16,"label":"Bau-Speedup (60min)"},
   {"kind":"xp_potion","qty":17,"label":"XP-Boost-Trank"},
   {"kind":"mana_potion","qty":30,"label":"Mana-Trank"},
   {"kind":"chest","tier":"silver","qty":5,"label":"Silber-Truhe"},
   {"kind":"resource","resource":"gold","qty":150000,"label":"Wegemünzen"},
   {"kind":"resource","resource":"wood","qty":150000,"label":"Holz"}
 ]'::jsonb,
 true)
on conflict (id) do nothing;

-- ── 2. Edelstein-Schwellen (Cashback-Ladder) ────────────────────────────
insert into public.monetization_gem_thresholds (id, threshold, reward_label, rewards, sort) values
('threshold_2400',  2400,  'Bronze-Truhe + 5 Speedups',
 '[{"kind":"chest","tier":"bronze","qty":1},{"kind":"speedup_60","qty":5}]'::jsonb, 1),
('threshold_4800',  4800,  'Silber-Truhe + Wächter-Ei',
 '[{"kind":"chest","tier":"silver","qty":1},{"kind":"egg","tier":"rare","qty":1}]'::jsonb, 2),
('threshold_8000',  8000,  'Gold-Truhe + 10 Speedups + Pin-Theme',
 '[{"kind":"chest","tier":"gold","qty":1},{"kind":"speedup_60","qty":10},{"kind":"pin_theme","theme_id":"frost_keep","qty":1}]'::jsonb, 3),
('threshold_12000', 12000, 'Exklusiver Marker-Skin',
 '[{"kind":"marker","marker_id":"premium_phoenix","qty":1},{"kind":"speedup_60","qty":15}]'::jsonb, 4),
('threshold_16000', 16000, 'Legendäres Wächter-Ei + Premium-Skin-Set',
 '[{"kind":"egg","tier":"legendary","qty":1},{"kind":"pin_theme","theme_id":"night_rose","qty":1},{"kind":"chest","tier":"gold","qty":3}]'::jsonb, 5)
on conflict (id) do nothing;

-- ── 3. Themen-Pakete (3 Stück, je 4,99 €, 1×/Tag) ───────────────────────
insert into public.monetization_themed_packs (id, theme, title, description, price_cents, bonus_gems, daily_limit, rewards, sort) values
('themed_explorer', 'explorer', 'Stadt-Erkunder',
 'Resourcen für ambitionierte Stadt-Eroberer. Speedups + Wegemünzen + Map-Boost.',
 499, 1250, 1,
 '[
   {"kind":"resource","resource":"gold","qty":250000,"label":"Wegemünzen"},
   {"kind":"resource","resource":"wood","qty":150000,"label":"Holz"},
   {"kind":"speedup_60","qty":8,"label":"Speedup (60 Min)"},
   {"kind":"speedup_5","qty":25,"label":"Bau-Speedup (5 Min)"},
   {"kind":"xp_potion","qty":5,"label":"XP-Boost"}
 ]'::jsonb, 1),
('themed_warrior', 'warrior', 'Krieger-Pfad',
 'Combat-Boosts + Truppen-Truhe + Crew-Buff für die nächste Schlacht.',
 499, 1250, 1,
 '[
   {"kind":"chest","tier":"silver","qty":1,"label":"Stein-Allianztruhe"},
   {"kind":"medal","tier":"epic","qty":5,"label":"Epische Medaille"},
   {"kind":"medal","tier":"legendary","qty":1,"label":"Legendäre Medaille"},
   {"kind":"xp_potion","qty":8,"label":"Combat-XP-Trank"},
   {"kind":"crew_buff","buff":"march_speed","qty":3,"label":"Crew-March-Speed"}
 ]'::jsonb, 2),
('themed_wisdom', 'wisdom', 'Wissens-Pfad',
 'XP-Tränke + Forschung-Speedup + Wächter-Boost für stetigen Aufstieg.',
 499, 1250, 1,
 '[
   {"kind":"chest","tier":"silver","qty":1,"label":"Stein-Allianztruhe"},
   {"kind":"speedup_research_60","qty":8,"label":"Forschung-Speedup (60 Min)"},
   {"kind":"speedup_research_5","qty":25,"label":"Forschung-Speedup (5 Min)"},
   {"kind":"xp_potion","qty":15,"label":"XP-Boost-Trank"},
   {"kind":"egg","tier":"rare","qty":1,"label":"Seltenes Wächter-Ei"}
 ]'::jsonb, 3)
on conflict (id) do nothing;

-- ── 4. Edelstein-Wert-Stufen (6 Tiers) ──────────────────────────────────
insert into public.monetization_gem_tiers (id, price_cents, base_gems, bonus_gems, badge_label, bonus_rewards, sort) values
('tier_499',   499,   1250,    63,   '+5% First-Time',         '[]'::jsonb, 1),
('tier_999',   999,   2750,    275,  '+10% Bonus',             '[]'::jsonb, 2),
('tier_1499',  1499,  4500,    900,  '+20% + Speedup-Pack',
   '[{"kind":"speedup_60","qty":10,"label":"Bonus: 10× Speedup"}]'::jsonb, 3),
('tier_2499',  2499,  8000,    2400, '+30% + Wächter-Ei',
   '[{"kind":"egg","tier":"rare","qty":1,"label":"Bonus: Rare-Wächter-Ei"}]'::jsonb, 4),
('tier_4999',  4999,  18000,   9000, '+50% + Pin-Theme + 7d Premium',
   '[{"kind":"pin_theme","theme_id":"viking","qty":1,"label":"Bonus: Pin-Theme"},{"kind":"premium","days":7,"label":"Bonus: 7 Tage Premium"}]'::jsonb, 5),
('tier_9999',  9999,  40000,   30000,'+75% + Legendäres Ei + 30d Premium',
   '[{"kind":"egg","tier":"legendary","qty":1,"label":"Bonus: Legendäres Ei"},{"kind":"marker","marker_id":"premium_dragon","qty":1,"label":"Bonus: Premium-Marker"},{"kind":"premium","days":30,"label":"Bonus: 30 Tage Premium"}]'::jsonb, 6)
on conflict (id) do nothing;

-- ── 5. Tagesangebote: Bronze/Silber/Gold-Pakete + SUPER-Bundle ─────────
-- Klassiker-RoK/CoD-Schema, slot 1=Bronze, 2=Silber, 3=Gold, 4=SUPER
do $$
declare
  v_day date := current_date;
  v_i int;
begin
  for v_i in 0..6 loop
    insert into public.monetization_daily_deals (deal_date, slot, title, description, price_cents, rewards) values
    (v_day + v_i, 1, '🥉 Bronze', '3h Wegemünzen-Boost ×2 + 200 Diamanten + Material', 99,
      '[
        {"kind":"xp_boost","duration_h":3,"multiplier":2,"label":"3h Wegemünzen-Boost (2×)"},
        {"kind":"siegel","qty_min":1,"qty_max":10,"label":"1-10 zufällige Siegel"},
        {"kind":"gem","qty":200,"label":"200 Diamanten"},
        {"kind":"material","qty":1,"label":"1× Ausrüstungsmaterial (zufällig)"},
        {"kind":"speed_token","qty":1,"label":"1× Speed-Token"}
      ]'::jsonb),
    (v_day + v_i, 2, '🥈 Silber', '9h Wegemünzen-Boost ×2 + 400 Diamanten + Silberne Truhe', 199,
      '[
        {"kind":"xp_boost","duration_h":9,"multiplier":2,"label":"9h Wegemünzen-Boost (2×)"},
        {"kind":"siegel","qty_min":1,"qty_max":10,"label":"1-10 zufällige Siegel"},
        {"kind":"gem","qty":400,"label":"400 Diamanten"},
        {"kind":"material","qty":2,"label":"2× Ausrüstungsmaterial (zufällig)"},
        {"kind":"speed_token","qty":1,"label":"1× Speed-Token"},
        {"kind":"chest","tier":"silver","qty":1,"label":"1× Silberne Truhe"}
      ]'::jsonb),
    (v_day + v_i, 3, '🥇 Gold', '12h Wegemünzen-Boost ×2 + 600 Diamanten + Goldene Truhe', 299,
      '[
        {"kind":"xp_boost","duration_h":12,"multiplier":2,"label":"12h Wegemünzen-Boost (2×)"},
        {"kind":"siegel","qty_min":1,"qty_max":10,"label":"1-10 zufällige Siegel"},
        {"kind":"gem","qty":600,"label":"600 Diamanten"},
        {"kind":"material","qty":3,"label":"3× Ausrüstungsmaterial (zufällig)"},
        {"kind":"speed_token","qty":1,"label":"1× Speed-Token"},
        {"kind":"chest","tier":"gold","qty":1,"label":"1× Goldene Truhe"}
      ]'::jsonb),
    (v_day + v_i, 4, '🔥 SUPER Tagesangebot', 'Alle 3 Pakete (Bronze + Silber + Gold) mit -50% Rabatt — statt 5,97 €', 299,
      '[
        {"kind":"bundle","includes":[1,2,3],"label":"Bronze + Silber + Gold zusammen"},
        {"kind":"discount","pct":50,"label":"-50% Rabatt auf 5,97 €"}
      ]'::jsonb)
    on conflict (deal_date, slot) do nothing;
  end loop;
end $$;

-- ── 6. Battle Pass — Saison Mai 2026 ────────────────────────────────────
insert into public.monetization_battle_pass_seasons (id, title, starts_at, ends_at, price_premium_cents, price_premium_plus_cents, active) values
('season_2026_05',
 'Berliner Frühling',
 '2026-05-01T00:00:00Z',
 '2026-05-31T23:59:59Z',
 499, 1499, true)
on conflict (id) do nothing;

-- 50 Battle-Pass-Levels — XP steigt linear, Free-Belohnung ab Level 5
do $$
declare
  v_lvl int;
  v_xp  int;
begin
  for v_lvl in 1..50 loop
    v_xp := v_lvl * 1000;
    insert into public.monetization_battle_pass_levels (season_id, level, xp_required, reward_free, reward_premium, reward_plus) values
    ('season_2026_05', v_lvl, v_xp,
      case when v_lvl % 5 = 0 then jsonb_build_array(jsonb_build_object('kind','speedup_60','qty',2)) else null end,
      jsonb_build_array(jsonb_build_object('kind','gem','qty', 50 + v_lvl * 10)),
      jsonb_build_array(jsonb_build_object('kind','gem','qty', 100 + v_lvl * 20),
                        jsonb_build_object('kind','speedup_60','qty', case when v_lvl % 3 = 0 then 1 else 0 end))
    )
    on conflict (season_id, level) do nothing;
  end loop;
end $$;

-- ── 7. Monats-Abos (3 Tiers) ────────────────────────────────────────────
insert into public.monetization_subscriptions (id, title, description, price_cents_monthly, daily_gems, perks, sort) values
('sub_wanderer', 'Wanderer',
 'Werbefrei + täglich 200 Edelsteine + 1× XP-Boost pro Tag',
 299, 200,
 '["adfree","daily_xp_boost_1x","daily_gems_200"]'::jsonb, 1),
('sub_pfadfinder', 'Pfadfinder',
 'Wanderer + täglich 500 Edelsteine + 2× XP + Premium-Marker + +50% Loot-Drops',
 499, 500,
 '["adfree","daily_xp_boost_2x","daily_gems_500","premium_markers","loot_boost_50pct"]'::jsonb, 2),
('sub_stadtmeister', 'Stadtmeister',
 'Pfadfinder + täglich 1500 Edelsteine + 3× XP + exklusive Pin-Themes + Crew-Boost',
 999, 1500,
 '["adfree","daily_xp_boost_3x","daily_gems_1500","premium_markers","loot_boost_50pct","exclusive_pin_themes","crew_boost"]'::jsonb, 3)
on conflict (id) do nothing;
