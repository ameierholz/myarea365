-- ══════════════════════════════════════════════════════════════════════════
-- Themes-Rework: Urban Berlin / Stadt / Crews / Dorf
--
-- Raus: medieval, scifi, pirate, viking, ninja, scarlet_palace, hall_of_order,
--       eternal_garden, volcanic_forge (alle Fantasy/Out-of-Theme)
-- Behalten: halloween (saisonal), frost_keep (saisonal Winter), night_rose (Gothic-Berlin)
-- Neu: 12 Stadt-/Dorf-Themes
--
-- Default ist jetzt 'plattenbau' (vorher 'medieval').
-- Bestehende Bases mit alten Themes werden auf 'plattenbau' umgestellt.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 0) Constraints erweitern: 'common' rarity + 'level' unlock_kind ──────
alter table public.base_themes drop constraint if exists base_themes_rarity_check;
alter table public.base_themes add constraint base_themes_rarity_check
  check (rarity in ('common', 'advanced', 'epic', 'legendary'));

alter table public.base_themes drop constraint if exists base_themes_unlock_kind_check;
alter table public.base_themes add constraint base_themes_unlock_kind_check
  check (unlock_kind in ('free', 'vip', 'coins', 'event', 'crew_level', 'level'));

-- ── 1) Neue Themes anlegen ────────────────────────────────────────────────
insert into public.base_themes
  (id, name, description, pin_emoji, pin_color, accent_color, rarity, sort, unlock_kind, unlock_value)
values
  ('plattenbau',     'Plattenbau-Block',    'Klassischer Berliner Plattenbau — grau, ehrlich, Heimat.', '🏢', '#8B8FA3', '#8B8FA3', 'common',    0,  'free', 0),
  ('altbau_hof',     'Altbau-Hof',          'Stuckfassade mit verstecktem Hinterhof.',                  '🏘️', '#D4A574', '#D4A574', 'common',    1,  'free', 0),
  ('spaeti',         'Späti-Festung',       'Eckspäti mit Leuchtreklame — 24/7 offen.',                 '🍺', '#FFD700', '#FFD700', 'advanced',  10, 'level', 5),
  ('hinterhof',      'Hinterhof-Garten',    'Urban Gardening, Lichterketten, Lagerfeuer.',              '🌿', '#22C55E', '#22C55E', 'advanced',  11, 'level', 8),
  ('werkstatt',      'Werkstatt-Hof',       'Auto-Werkstatt, Container, Funkenflug.',                   '🔧', '#FF6B4A', '#FF6B4A', 'advanced',  12, 'level', 10),
  ('container_camp', 'Container-Camp',      'Stapel-Container mit Graffiti, urbane Festung.',           '📦', '#A78BFA', '#A78BFA', 'advanced',  13, 'level', 12),
  ('ubahn',          'U-Bahn-Eingang',      'Treppenabgang mit Neonröhren, BVG-Vibes.',                 '🚇', '#22D1C3', '#22D1C3', 'epic',      20, 'level', 18),
  ('graffiti_tower', 'Graffiti-Tower',      'Hochhaus mit überlebensgroßem Mural.',                     '🎨', '#FF2D78', '#FF2D78', 'epic',      21, 'level', 22),
  ('techno_club',    'Techno-Club',         'Industrial-Architektur, Lasershow, Bass-Pulse.',           '🎶', '#A855F7', '#A855F7', 'epic',      22, 'level', 25),
  ('penthouse',      'Hochhaus-Penthouse',  'Skyline-Suite mit Pool und Panoramablick.',                '🌃', '#5DDAF0', '#5DDAF0', 'epic',      23, 'level', 28),
  ('dachterrasse',   'Dachterrassen-Festung','Multi-Level-Dachterrasse mit Pool, Bar und Lounge.',      '🏙️', '#FFD700', '#FFD700', 'legendary', 30, 'level', 35),
  ('wagenburg',      'Squat / Wagenburg',   'Bauwagen-Camp mit Lagerfeuer und Lampions.',               '🚐', '#FF8C00', '#FF8C00', 'legendary', 31, 'level', 40)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  pin_emoji = excluded.pin_emoji,
  pin_color = excluded.pin_color,
  accent_color = excluded.accent_color,
  rarity = excluded.rarity,
  sort = excluded.sort,
  unlock_kind = excluded.unlock_kind,
  unlock_value = excluded.unlock_value;

-- ── 2) Bestehende Bases auf 'plattenbau' umstellen, wenn altes Theme ──
update public.bases
   set theme_id = 'plattenbau'
 where theme_id in (
   'medieval', 'scifi', 'pirate', 'viking', 'ninja',
   'scarlet_palace', 'hall_of_order', 'eternal_garden', 'volcanic_forge'
 );

update public.crew_bases
   set theme_id = 'plattenbau'
 where theme_id in (
   'medieval', 'scifi', 'pirate', 'viking', 'ninja',
   'scarlet_palace', 'hall_of_order', 'eternal_garden', 'volcanic_forge'
 );

-- ── 3) Alte Themes löschen ───────────────────────────────────────────────
delete from public.base_themes
 where id in (
   'medieval', 'scifi', 'pirate', 'viking', 'ninja',
   'scarlet_palace', 'hall_of_order', 'eternal_garden', 'volcanic_forge'
 );

-- ── 4) Halloween / Frost / Night-Rose neu sortieren ──────────────────────
update public.base_themes set sort = 50, rarity = 'epic'      where id = 'halloween';
update public.base_themes set sort = 51, rarity = 'epic'      where id = 'frost_keep';
update public.base_themes set sort = 52, rarity = 'legendary' where id = 'night_rose';
