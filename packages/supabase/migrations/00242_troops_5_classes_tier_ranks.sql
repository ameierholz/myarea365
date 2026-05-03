-- ─── 00242: 5 Truppen-Klassen + Tier-Rang-Schema ──────────────────
-- Klassen: infantry/cavalry/marksman/siege + NEU collector (Sammler)
-- Display-Namen: {Klasse} {Rang} mit einheitlichem Tier-Schema
--   T1 Rookie · T2 Stamm · T3 Profi · T4 Elite · T5 Boss

-- 1. Check-Constraint erweitern: 'collector' erlauben
alter table public.troops_catalog drop constraint troops_catalog_troop_class_check;
alter table public.troops_catalog add constraint troops_catalog_troop_class_check
  check (troop_class = any (array['infantry','cavalry','marksman','siege','collector']));

-- 2. Bestehende 20 Truppen umbenennen — einheitliches {Klasse} {Rang}
update public.troops_catalog set name =
  case troop_class
    when 'infantry'  then 'Türsteher'
    when 'cavalry'   then 'Kurier'
    when 'marksman'  then 'Schütze'
    when 'siege'     then 'Brecher'
    when 'collector' then 'Sammler'
  end
  || ' ' ||
  case tier
    when 1 then 'Rookie'
    when 2 then 'Stamm'
    when 3 then 'Profi'
    when 4 then 'Elite'
    when 5 then 'Boss'
  end;

-- 3. Sammler-Klasse einfügen (5 Tiers)
-- Stats: niedrigere Kampf-Werte als Infanterie (Rolle: Sammeln, nicht Kampf)
-- Kosten: leicht über Infanterie (RSS-Spezialisten = Premium)
insert into public.troops_catalog
  (id, name, emoji, troop_class, tier, base_atk, base_def, base_hp,
   cost_wood, cost_stone, cost_gold, cost_mana, train_time_seconds,
   required_building_level, description) values
  ('col_t1','Sammler Rookie','📦','collector',1, 30, 35,  60,  10,  6, 12,  4,  20,  1, 'Sammelt Ressourcen schneller — schwächer im Kampf.'),
  ('col_t2','Sammler Stamm', '📦','collector',2, 50, 58, 100, 16, 10, 20,  6,  35,  5, 'Sammelt Ressourcen schneller — schwächer im Kampf.'),
  ('col_t3','Sammler Profi', '📦','collector',3, 75, 87, 150, 23, 14, 30, 10,  52, 10, 'Sammelt Ressourcen schneller — schwächer im Kampf.'),
  ('col_t4','Sammler Elite', '📦','collector',4,100,116, 200, 30, 18, 40, 12,  70, 15, 'Sammelt Ressourcen schneller — schwächer im Kampf.'),
  ('col_t5','Sammler Boss',  '📦','collector',5,130,151, 260, 40, 24, 52, 16,  92, 20, 'Sammelt Ressourcen schneller — schwächer im Kampf.');
