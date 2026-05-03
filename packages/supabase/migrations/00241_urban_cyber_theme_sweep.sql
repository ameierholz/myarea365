-- ─── 00241: Urban-Cyber Theme-Sweep ──────────────────────────────────
-- Schritt-für-Schritt audit ergab: Item/Potion/Building-Kataloge
-- tragen noch mittelalterliche Fantasy-Namen aus dem alten Konzept.
-- Hier: nur Display-Names umbenennen (description ggf. mit), IDs bleiben
-- für Code-Refs. Class-IDs (melee/ranged/support/tank) bleiben — nur
-- die Display-Themen ändern sich.
--
-- Konzept:
-- - melee   → Brawler   (Faust/Nahkampf)
-- - ranged  → Sniper    (Distanz)
-- - support → Medic     (Heilung/Buff)
-- - tank    → Tank      (Defensive)
--
-- - Slots:  boots→Sneaker, chest→Weste, gloves→Wraps, helm→Cap,
--           legs→Cargo, necklace→Chain, ring→Band, weapon→Tool

-- ═══ 1. item_catalog (128 Items) ═══════════════════════════════════
update public.item_catalog set name =
  case class_id
    when 'melee'   then 'Brawler'
    when 'ranged'  then 'Sniper'
    when 'support' then 'Medic'
    when 'tank'    then 'Tank'
    else class_id
  end
  || '-' ||
  case slot
    when 'boots'    then 'Sneaker'
    when 'chest'    then 'Weste'
    when 'gloves'   then 'Wraps'
    when 'helm'     then 'Cap'
    when 'legs'     then 'Cargo'
    when 'necklace' then 'Chain'
    when 'ring'     then 'Band'
    when 'weapon'   then 'Tool'
    else slot
  end
  || ' (' ||
  case rarity
    when 'common' then 'Gewöhnlich'
    when 'rare'   then 'Selten'
    when 'epic'   then 'Episch'
    when 'legend' then 'Legendär'
    else rarity
  end
  || ')';

-- ═══ 2. potion_catalog (16 Items) ══════════════════════════════════
-- "Trank" → "Stim" / "Booster" / "Pack" — urban-cyber Pharma/Doping
update public.potion_catalog set name = case id
  when 'potion_atk_l'          then 'Großer Damage-Stim'
  when 'potion_atk_m'          then 'Damage-Stim'
  when 'potion_atk_s'          then 'Kleiner Damage-Stim'
  when 'potion_crit_m'         then 'Krit-Stim'
  when 'potion_def_m'          then 'Defense-Stim'
  when 'potion_def_s'          then 'Kleiner Defense-Stim'
  when 'potion_hp_l'           then 'Großes HP-Pack'
  when 'potion_hp_m'           then 'HP-Pack'
  when 'potion_hp_s'           then 'Kleines HP-Pack'
  when 'potion_lifesteal_m'    then 'Drain-Stim'
  when 'potion_mana_m'         then 'Bandbreite-Boost'
  when 'potion_penetration_l'  then 'Pierce-Stim'
  when 'potion_regen_l'        then 'Großes Regen-Pack'
  when 'potion_regen_s'        then 'Kleines Regen-Pack'
  when 'potion_speed_s'        then 'Speed-Stim'
  when 'potion_thorns_l'       then 'Reflect-Stim'
  else name
end;

-- ═══ 3. buildings_catalog (~30 Updates) ════════════════════════════
update public.buildings_catalog set name = case id
  -- combat
  when 'arena_halle'          then 'Arena'
  when 'ballistenwerk'        then 'Drohnen-Werkstatt'
  when 'belagerungsschuppen'  then 'Werkhof'
  when 'bergfried'            then 'Kommandozentrale'
  when 'bogenschuetzenstand'  then 'Sniper-Nest'
  when 'crew_bergfried'       then 'Crew-HQ'
  when 'crew_hospital'        then 'Crew-Klinik'
  when 'crew_stadtmauer'      then 'Crew-Bollwerk'
  when 'hospital'             then 'Klinik'
  when 'kaserne'              then 'Bar'
  when 'sammel_leuchtfeuer'   then 'Signal-Bake'
  when 'schiessstand'         then 'Gym'
  when 'schwertkampflager'    then 'Faust-Studio'
  when 'spaeher_wachposten'   then 'Späher-Posten'
  when 'stadtmauer'           then 'Bollwerk'
  when 'stall'                then 'Garage'
  when 'tempel_himmlisch'     then 'Funkturm'
  when 'trainingsplatz'       then 'Übungs-Hof'
  when 'wachturm'             then 'Posten-Turm'
  when 'waechter_halle'       then 'Wächter-Halle'
  -- cosmetic
  when 'brunnen'              then 'Springbrunnen'
  when 'shop'                 then 'Kosmetik-Stand'
  when 'statue'               then 'Graffiti-Wall'
  -- production
  when 'crew_taverne'         then 'Crew-Bar'
  when 'crew_treffpunkt'      then 'Crew-Treffpunkt'
  when 'gasthaus'             then 'Rast-Kiosk'
  when 'goldmine'             then 'Krypto-Mine'
  when 'mana_quell'           then 'Bandbreite-Quelle'
  when 'mana_quelle'          then 'Datacenter'
  when 'saegewerk'            then 'Recycling-Hof'
  when 'steinbruch'           then 'Komponenten-Werk'
  when 'wald_pfad'            then 'Park-Pfad'
  -- storage
  when 'kornkammer'           then 'Vorrats-Depot'
  when 'lagerhalle'           then 'Lauf-Lager'
  when 'mauerwerk'            then 'Komponenten-Speicher'
  when 'tresorraum'           then 'Geheim-Tresor'
  when 'truhenkammer'         then 'Truhen-Depot'
  when 'wegekasse'            then 'Mautstation'
  -- utility
  when 'akademie'             then 'Hacker-Lab'
  when 'allianz_zentrum'      then 'Crew-Zentrum'
  when 'augurstein'           then 'Daten-Orakel'
  when 'basar'                then 'Trading-Post'
  when 'burg'                 then 'Base'
  when 'crew_akademie'        then 'Crew-Lab'
  when 'goblin_markt'         then 'Schwarzmarkt'
  when 'halbling_haus'        then 'Bau-Büro'
  when 'kloster'              then 'Underground-Schrein'
  when 'laufturm'             then 'Lauf-Türme'
  when 'schmiede'             then 'Modding-Shop'
  when 'schwarzes_brett'      then 'Quest-Tafel'
  else name
end;

-- ═══ 4. material_catalog ═══════════════════════════════════════════
update public.material_catalog set name = case id
  when 'crystal' then 'Daten-Kristall'
  when 'essence' then 'Schatten-Essenz'
  when 'relikt'  then 'Legacy-Chip'
  when 'scrap'   then 'Schrott'
  else name
end;

-- ═══ 5. troops_catalog mks_* (Marksman → Sniper) ═══════════════════
update public.troops_catalog set name = case id
  when 'mks_t1' then 'Späher'
  when 'mks_t2' then 'Schütze'
  when 'mks_t3' then 'Scharfschütze'
  when 'mks_t4' then 'Sniper'
  when 'mks_t5' then 'Scope-Meister'
  else name
end where id like 'mks_%';

-- ═══ 6. base_themes — Berlin-Spezifika neutralisieren ══════════════
update public.base_themes set name = case id
  when 'spaeti'     then 'Eckladen-Festung'
  when 'ubahn'      then 'Metro-Eingang'
  when 'plattenbau' then 'Hochhaus-Block'
  when 'wagenburg'  then 'Squat / Container-Camp'
  else name
end where id in ('spaeti','ubahn','plattenbau','wagenburg');
