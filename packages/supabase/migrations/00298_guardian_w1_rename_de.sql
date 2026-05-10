-- 00298_guardian_w1_rename_de.sql
-- Rebrand W1-Wächter auf urban-cyber-deutsch (raus mit Skywatch/Slumlord/Loot-Bot/Sky-Strike/Auto-Pick)

UPDATE guardian_archetypes SET
  name = 'Athe-Himmelswache',
  ability_name = 'Drohnen-Sturm',
  ability_desc = 'Schickt einen Drohnen-Schwarm aus der Luft auf einen Punkt — 280% Magie-Schaden in einem Radius. Verlangsamt Gegner um 20% für 4 Sekunden.',
  lore = 'Drohnen-Pilotin des Stadtrats, ausgebildet im Himmels-Wach-Programm.'
WHERE id = 'gs1_athe';

UPDATE guardian_archetypes SET
  name = 'Bakhar-Gossenherr'
WHERE id = 'gs1_bakhar';

UPDATE guardian_archetypes SET
  ability_desc = 'Markiert ein Gebiet — Sammler-Truppen erhalten +35% Beute auf Plünder-Nodes für 30 Minuten. Im Kampf: +18% Crit-Chance.',
  lore = 'Wegelager-Veteran aus dem Gossenbund. Findet Beute-Stellen wo andere nur Trümmer sehen.'
WHERE id = 'gs1_chak';

UPDATE guardian_archetypes SET
  name = 'Sammel-Bot Mk7',
  ability_name = 'Auto-Sammler',
  ability_desc = 'Sammelt automatisch Tech-Schrott und Komponenten in einem Radius. +20% Beute, +10% Sammel-Geschwindigkeit auf allen Nodes.',
  lore = 'Kronenwacht-Standardmodell. Billig, zuverlässig, ein bisschen langweilig — aber farmt schneller als jeder Mensch.'
WHERE id = 'gs1_lootbot7';
