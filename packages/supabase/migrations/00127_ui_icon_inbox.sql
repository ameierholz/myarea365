-- ════════════════════════════════════════════════════════════════════
-- UI-ICON SLOTS — Inbox-Kategorien & Badges
-- ════════════════════════════════════════════════════════════════════
-- Inbox (3-Spalten-CoD-Style) nutzt aktuell Emoji für alle Kategorien
-- (✉️ persönlich, 📜 bericht, 🛡️ crew, 🎉 events, ⚙️ system, 📤 gesendet)
-- sowie für Belohnungs- und Stern-Badges. Diese Slots erlauben dem
-- Admin pro Slot eigenes Greenscreen-Artwork hochzuladen.
-- ════════════════════════════════════════════════════════════════════

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  -- Inbox-Kategorien (Sidebar)
  ('inbox_personal',       'badge', 'Inbox · Persönlich',       'Sidebar-Icon: persönliche Nachrichten',                   '✉️',  40),
  ('inbox_report',         'badge', 'Inbox · Bericht',          'Sidebar-Icon: Kampf-/Späher-Berichte',                    '📜',  41),
  ('inbox_crew',           'badge', 'Inbox · Crew',             'Sidebar-Icon: Crew-Dekrete/Bekanntmachungen',             '🛡️',  42),
  ('inbox_event',          'badge', 'Inbox · Events',           'Sidebar-Icon: Event-Benachrichtigungen',                  '🎉',  43),
  ('inbox_system',         'badge', 'Inbox · System',           'Sidebar-Icon: System-/Achievement-Posts',                 '⚙️',  44),
  ('inbox_sent',           'badge', 'Inbox · Gesendet',         'Sidebar-Icon: gesendete Nachrichten',                     '📤',  45),
  -- Inbox-Badges
  ('inbox_fab',            'badge', 'Inbox-FAB',                'Hauptmenu-Button (Posteingang öffnen)',                   '📬',  46),
  ('inbox_reward',         'badge', 'Belohnung wartet',         'Badge: ungeclaimte Belohnung in Nachricht',               '🎁',  47),
  ('inbox_starred',        'badge', 'Markiert/Stern',           'Badge: gespeicherte/markierte Nachricht',                 '⭐',  48),
  ('inbox_unread',         'badge', 'Ungelesen-Punkt',          'Badge: ungelesener Eintrag in Liste',                     '🔵',  49),
  -- Report-Sub-Typen (für Bericht-Kategorie)
  ('inbox_report_pvp',     'badge', 'Bericht · PvP',            'Sub-Icon: PvP-Kampfbericht',                              '⚔️',  50),
  ('inbox_report_pve',     'badge', 'Bericht · PvE',            'Sub-Icon: PvE/Wegelager-Bericht',                         '🏹',  51),
  ('inbox_report_spy',     'badge', 'Bericht · Späher',         'Sub-Icon: Spionage-Bericht',                              '🔍',  52),
  -- Crew-Sub-Typen
  ('inbox_crew_decree',    'badge', 'Crew · Dekret',            'Sub-Icon: Crew-Dekret (Boss-Mitteilung)',                 '📜',  53),
  ('inbox_crew_announce',  'badge', 'Crew · Bekanntmachung',    'Sub-Icon: Crew-weite Bekanntmachung',                     '📣',  54),
  ('inbox_crew_bounty',    'badge', 'Crew · Kopfgeld',          'Sub-Icon: Crew-Kopfgeld-Auftrag',                         '🎯',  55),
  ('inbox_crew_build',     'badge', 'Crew · Baubericht',        'Sub-Icon: automatischer Baubericht',                      '🏗️',  56)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
