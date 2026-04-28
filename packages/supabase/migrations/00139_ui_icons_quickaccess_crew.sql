-- ════════════════════════════════════════════════════════════════════
-- UI-Icon-Slots für MapQuickAccess + CrewModal + Ansehen-Badge
-- Alle Quick-Access-Buttons + Crew-Modal-Tabs müssen via Artwork-System
-- gepflegt werden können (Memory-Regel "Artwork-Icons IMMER").
-- ════════════════════════════════════════════════════════════════════

-- Check-Constraint erweitern: bisher 'stat','class','action','badge','misc' →
-- jetzt zusätzlich 'quick','crew_tab','building'.
alter table public.ui_icon_slots drop constraint if exists ui_icon_slots_category_check;
alter table public.ui_icon_slots add constraint ui_icon_slots_category_check
  check (category in ('stat','class','action','badge','misc','quick','crew_tab','building'));

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  -- MapQuickAccess (Bottom-Bar rechts)
  ('quick_base',       'quick',  'Quickzugriff: Eigene Base',  'Schwebe-Button rechts unten — eigene Base öffnen',           '🏰', 100),
  ('quick_rally',      'quick',  'Quickzugriff: Crew-Angriff', 'Schwebe-Button rechts unten — offene Crew-Rallies',          '⚔',  101),
  ('quick_crew',       'quick',  'Quickzugriff: Crew',         'Schwebe-Button rechts unten — Crew-Modal öffnen',            '👥', 102),
  ('quick_wegelager',  'quick',  'Quickzugriff: Wegelager',    'Schwebe-Button rechts unten — Wegelager in der Nähe',        '📜', 103),
  ('quick_shop',       'quick',  'Quickzugriff: Shop',         'Schwebe-Button rechts unten — Tagesangebote/Shop',           '🎁', 104),
  ('quick_inbox',      'quick',  'Quickzugriff: Posteingang',  'Schwebe-Button rechts unten — Inbox/Reports',                '📬', 105),
  ('quick_achieve',    'quick',  'Quickzugriff: Erfolge',      'Schwebe-Button rechts unten — Erfolge/Achievements',         '🏅', 106),

  -- CrewModal Tab-Icons
  ('crew_tab_overview',  'crew_tab', 'Crew-Tab: Übersicht',     'Tab-Icon im Crew-Modal — Übersicht',          '📋', 200),
  ('crew_tab_members',   'crew_tab', 'Crew-Tab: Mitglieder',    'Tab-Icon im Crew-Modal — Mitglieder',         '👥', 201),
  ('crew_tab_research',  'crew_tab', 'Crew-Tab: Forschung',     'Tab-Icon im Crew-Modal — Forschung',          '🧪', 202),
  ('crew_tab_bounties',  'crew_tab', 'Crew-Tab: Kopfgelder',    'Tab-Icon im Crew-Modal — Kopfgelder',         '🎯', 203),
  ('crew_tab_shop',      'crew_tab', 'Crew-Tab: Lagerhaus',     'Tab-Icon im Crew-Modal — Lagerhaus/Shop',     '📦', 204),
  ('crew_tab_settings',  'crew_tab', 'Crew-Tab: Einstellungen', 'Tab-Icon im Crew-Modal — Einstellungen',      '⚙', 205),

  -- Misc Game-Icons (Ansehen, Repeater-Kinds etc.)
  ('stat_ansehen',     'stat',   'Ansehen-Badge',              'Symbol für Ansehen/Power-Score (Pokal/Krone)',               '⚜', 300),
  ('repeater_hq',      'building', 'Repeater: Hauptquartier',  'Crew-Hauptquartier auf Map + in Listen',                     '🏛', 310),
  ('repeater_mega',    'building', 'Repeater: Mega-Funk',      'Mega-Funkmast (Großstationer)',                              '📡', 311),
  ('repeater_normal',  'building', 'Repeater: Standard',       'Standard-Funkmast',                                          '📶', 312)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
