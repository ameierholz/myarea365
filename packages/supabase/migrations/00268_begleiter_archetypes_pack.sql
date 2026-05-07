-- ════════════════════════════════════════════════════════════════════
-- BEGLEITER-PACK (9 neue Archetypes mit GLB-Modellen)
-- ════════════════════════════════════════════════════════════════════
-- Fügt 9 Begleiter aus dem Quaternius-Pack hinzu (alle mit GLB unter
-- /3d/begleiter/{id}.glb + Portrait /3d/begleiter/{id}.png).
--
-- Klassen-Zuordnung passend zum Look:
--   Brute       → infantry/tank      (Hau-drauf, robust)
--   4GTN        → infantry/krieger   (Roboter-Wächter)
--   Cleric      → mage/kleriker      (Heiler-Caster)
--   Marksman    → marksman/bogenschuetze (Schütze)
--   Avian       → cavalry/ritter     (fliegender Reiter)
--   Hoarder     → infantry/support   (Sammler/Loot-Spec)
--   Lorekeeper  → mage/magier        (Buch-Magie)
--   Monstrosity → infantry/berserker (Monster-DPS)
--   Planty      → mage/priester      (Pflanzen-Heiler)
-- ════════════════════════════════════════════════════════════════════

insert into public.guardian_archetypes (
  id, name, emoji, rarity, guardian_type, role, gender,
  base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc, image_url, lore
) values
  ('bgl_brute', 'Brute', '💪', 'epic', 'infantry', 'tank', 'male',
   2400, 220, 180, 75,
   'iron_smash', 'Eisenfaust', 'Schlägt eine Welle, die alle Gegner in 3m kurz betäubt.',
   '/3d/begleiter/brute.png',
   'Ehemaliger Türsteher, der nur mit der Faust kommuniziert.'),
  ('bgl_4gtn', 'Wächter-4GTN', '🤖', 'epic', 'infantry', 'krieger', 'neutral',
   2100, 240, 200, 90,
   'sentinel_protocol', 'Sentinel-Protokoll', 'Aktiviert Schild-Modus: -50% Schaden für 5 s.',
   '/3d/begleiter/4gtn.png',
   'Letzte Einheit aus der vergessenen Wächter-Linie. Selbstreparierend.'),
  ('bgl_cleric', 'Klerikerin', '✨', 'legendary', 'mage', 'kleriker', 'female',
   1700, 180, 140, 105,
   'holy_pulse', 'Heiliger Puls', 'Heilt alle Begleiter im Aufgebot um 15% HP.',
   '/3d/begleiter/cleric.png',
   'Sie spricht zu Geistern und schliesst Wunden mit blossen Händen.'),
  ('bgl_marksman', 'Schütze', '🏹', 'epic', 'marksman', 'bogenschuetze', 'male',
   1600, 280, 110, 115,
   'piercing_shot', 'Durchschlagspfeil', 'Pfeil ignoriert 50% Verteidigung des ersten Ziels.',
   '/3d/begleiter/marksman.png',
   'Trifft ein Streichholz auf 200 m. Sagt nicht viel.'),
  ('bgl_avian', 'Sturmflügel', '🦅', 'legendary', 'cavalry', 'ritter', 'female',
   1900, 230, 150, 145,
   'dive_strike', 'Sturzangriff', 'Stürzt aus der Luft, +60% Schaden auf erstes Ziel.',
   '/3d/begleiter/avian.png',
   'Reitet Sturmvögel quer über die Stadt. Schneller als jede Drohne.'),
  ('bgl_hoarder', 'Hamsterin', '💰', 'rare', 'infantry', 'support', 'female',
   1800, 160, 170, 95,
   'loot_magnet', 'Beute-Magnet', '+25% Ressourcen-Yield bei diesem Marsch.',
   '/3d/begleiter/hoarder.png',
   'Hat einen Sechsten Sinn für vergessene Krypto-Wallets.'),
  ('bgl_lorekeeper', 'Lorekeeper', '📖', 'epic', 'mage', 'magier', 'male',
   1700, 220, 130, 100,
   'arcane_volley', 'Arkan-Salve', '3 magische Geschosse auf zufällige Ziele.',
   '/3d/begleiter/lorekeeper.png',
   'Bewahrer der alten Codes. Liest aus Büchern, die niemand sonst öffnet.'),
  ('bgl_monstrosity', 'Bestie', '👹', 'epic', 'infantry', 'berserker', 'neutral',
   2600, 270, 120, 80,
   'rage_burst', 'Wut-Ausbruch', 'Bei <30% HP: +80% ATK für 8 s.',
   '/3d/begleiter/monstrosity.png',
   'Niemand weiss, woher sie kommt. Nur dass sie immer hungrig ist.'),
  ('bgl_planty', 'Pflanzling', '🌿', 'rare', 'mage', 'priester', 'neutral',
   1500, 150, 200, 85,
   'verdant_aura', 'Grüne Aura', 'Heilt 5% HP/s für 6 s, alle Begleiter im Aufgebot.',
   '/3d/begleiter/planty.png',
   'Wächst aus jeder Asphaltritze. Wird grimmig wenn jemand auf Blumen tritt.')
on conflict (id) do update set
  name          = excluded.name,
  emoji         = excluded.emoji,
  rarity        = excluded.rarity,
  guardian_type = excluded.guardian_type,
  role          = excluded.role,
  gender        = excluded.gender,
  base_hp       = excluded.base_hp,
  base_atk      = excluded.base_atk,
  base_def      = excluded.base_def,
  base_spd      = excluded.base_spd,
  ability_id    = excluded.ability_id,
  ability_name  = excluded.ability_name,
  ability_desc  = excluded.ability_desc,
  image_url     = excluded.image_url,
  lore          = excluded.lore;

-- ─── Auto-Grant: Test-User Kaelthor Malven bekommt alle 9 Begleiter ──
-- Damit /karte/base + Einsatz-Modal direkt was zur Auswahl haben.
do $$
declare
  v_uid uuid;
  arch_id text;
begin
  select id into v_uid from public.users where lower(display_name) = 'kaelthor malven' or lower(handle) = 'kaelthor' limit 1;
  if v_uid is null then return; end if;
  for arch_id in select id from public.guardian_archetypes where id like 'bgl_%' loop
    insert into public.user_guardians (user_id, archetype_id, level, xp, is_active)
    values (v_uid, arch_id, 1, 0, true)
    on conflict do nothing;
  end loop;
end $$;
