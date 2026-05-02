-- ══════════════════════════════════════════════════════════════════════════
-- Banner + Base-Ring-Rework: out-of-theme Fantasy raus, internationale
-- Stadt/Crew/Dorf-Themen rein. International — nicht Berlin-spezifisch.
--
-- Banner (8 raus, 9 neu):
--   raus: frost_crown, inferno, arcane_scroll, samurai, royal, dragon,
--         phoenix, starforged
--   neu:  graffiti_tag (universal), subway_line, skyline_silhouette,
--         club_strobe, concrete_strip, streetfood_label, punk_stickers,
--         city_lights, crew_tag
--
-- Base-Rings (3 raus, 3 neu):
--   raus: coral, dragon, phoenix
--   neu:  transit_ring, streetfood_halo, spray_tag_ring
-- ══════════════════════════════════════════════════════════════════════════

-- ── BANNER (nameplates) — Fantasy raus ────────────────────────────────────
update public.users set equipped_nameplate_id = 'default'
 where equipped_nameplate_id in ('frost_crown','inferno','arcane_scroll','samurai','royal','dragon','phoenix','starforged');
delete from public.user_nameplates
 where nameplate_id in ('frost_crown','inferno','arcane_scroll','samurai','royal','dragon','phoenix','starforged');
delete from public.nameplates
 where id in ('frost_crown','inferno','arcane_scroll','samurai','royal','dragon','phoenix','starforged');

-- ── Internationale Banner-Themes ─────────────────────────────────────────
insert into public.nameplates (id, name, description, rarity, sort)
values
  ('graffiti_tag',     'Graffiti-Tag',       'Magenta-Spray-Tag mit Drips, Streetart-Stil.',                          'epic',      39),
  ('subway_line',      'Metro-Linie',        'Verkehrsschild-Streifen mit Linien-Symbol — urban transit.',           'epic',      40),
  ('skyline_silhouette','City-Skyline',      'Schwarze Hochhaus-Silhouette mit leuchtenden Fensterreihen.',          'legendary', 41),
  ('club_strobe',      'Club-Strobe',        'Pulsierende Lasershow-Strobes in Pink + Cyan, Nightlife-Vibe.',        'epic',      42),
  ('concrete_strip',   'Beton-Streifen',     'Brutalist-Beton mit gelben Bauarbeiter-Akzenten.',                     'advanced',  43),
  ('streetfood_label', 'Streetfood-Marke',   'Imbissbude-Schild-Optik mit warmen Lichtern.',                         'advanced',  44),
  ('punk_stickers',    'Punk-Sticker',       'Aufkleber-Collage mit DIY-Patches und Antifa-Pink.',                   'epic',      45),
  ('city_lights',      'City-Lights',        'Neon-Schriftzug-Style mit warmem Glühröhren-Glow.',                    'epic',      46),
  ('crew_tag',         'Crew-Tag',           'Heraldisches Crew-Wappen mit Schriftrolle und Initialen.',             'legendary', 47)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity, sort = excluded.sort;

-- ── BASE-RINGS — Fantasy raus ─────────────────────────────────────────────
update public.users set equipped_base_ring_id = 'default'
 where equipped_base_ring_id in ('coral','dragon','phoenix');
delete from public.user_base_rings
 where ring_id in ('coral','dragon','phoenix');
delete from public.base_rings
 where id in ('coral','dragon','phoenix');

-- ── Internationale Ring-Themes ───────────────────────────────────────────
insert into public.base_rings (id, name, description, rarity, sort)
values
  ('transit_ring',     'Transit-Ring',       'Metro/Subway-Gelb mit rotierendem Linien-Symbol.',                     'epic',      40),
  ('streetfood_halo',  'Streetfood-Halo',    'Warme Imbiss-Vibes mit Pommes-Gold-Sprinkles.',                        'epic',      41),
  ('spray_tag_ring',   'Spray-Tag-Ring',     'Streetart-Spray mit Drips und Magenta-Akzenten.',                      'legendary', 42)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity, sort = excluded.sort;
