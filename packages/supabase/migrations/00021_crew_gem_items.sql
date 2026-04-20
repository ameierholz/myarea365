-- Crew-Gem-Items: kosmetische Käufe für Crews (keine Stat-Vorteile)
-- Crew-Spalten für die Effekte
alter table public.crews
  add column if not exists custom_emblem_url text,
  add column if not exists territory_color text,
  add column if not exists name_glow_until timestamptz,
  add column if not exists animated_banner_until timestamptz,
  add column if not exists founder_badge boolean not null default false;

-- Shout-Guthaben pro User (Crew-weite Shouts landen hier, damit pro Member limitiert)
alter table public.users
  add column if not exists crew_shouts_remaining int not null default 0;

-- Seed: Crew-Kosmetik-Items
insert into public.gem_shop_items (id, category, name, description, icon, price_gems, duration_hours, payload, sort) values
  ('crew_custom_flag',      'crew_emblem', 'Custom Crew-Flagge',       'Eigenes Emblem-Bild für deine Crew hochladen',                        '🎨',  500, null, '{"effect":"custom_emblem"}',         10),
  ('crew_territory_color',  'crew_emblem', 'Crew-Territorium-Farbe',   'Eigene Farbe für alle Crew-Territorien auf der Karte',                '🎨',  600, null, '{"effect":"territory_color"}',       20),
  ('crew_name_glow',        'crew_emblem', 'Crew-Name-Glow (30 Tage)', 'Animierter Regenbogen-Glow für den Crew-Namen, 30 Tage',              '✨',  700,  720, '{"effect":"name_glow","days":30}',   30),
  ('crew_animated_banner',  'crew_emblem', 'Animiertes Crew-Banner',   'Animiertes Hintergrund-Banner für Crew-Profil, 30 Tage',              '🌈',  800,  720, '{"effect":"animated_banner","days":30}', 40),
  ('crew_shout_pack_10',    'crew_emblem', 'Crew-Shout-Pack (10×)',    '10× Kiez-Shouts an alle Crew-Mitglieder',                             '📣',  400, null, '{"effect":"shouts","amount":10}',    50),
  ('crew_founder_badge',    'crew_emblem', 'Gründungsurkunde-Badge',   'Einmaliges exklusives Founder-Badge im Profil (nur Crew-Gründer)',    '🏆', 1200, null, '{"effect":"founder_badge","unique":true}', 60)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  price_gems = excluded.price_gems,
  duration_hours = excluded.duration_hours,
  payload = excluded.payload,
  sort = excluded.sort,
  active = true;
