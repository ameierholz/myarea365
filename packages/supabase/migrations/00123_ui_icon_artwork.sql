-- ════════════════════════════════════════════════════════════════════
-- UI-ICON ARTWORK — generischer Slot für alle Inline-Icons im UI
-- ════════════════════════════════════════════════════════════════════
-- Bisher waren nur konkrete Entitäten (resource/chest/building/...)
-- über das Artwork-System pflegbar. Stat-Symbole (⚔️/🛡️), Klassen-
-- Icons (🛡 🐎 🏹 ⚙) und Action-Buttons (🔍 📣 ⚔️) blieben Emoji.
-- Dieses Kind erlaubt dem Admin, JEDEN UI-Icon-Slot durch ein eigenes
-- Greenscreen-Artwork zu ersetzen.
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'cosmetic_artwork'
      and c.conname = 'cosmetic_artwork_kind_check'
  ) then
    alter table public.cosmetic_artwork drop constraint cosmetic_artwork_kind_check;
  end if;

  alter table public.cosmetic_artwork
    add constraint cosmetic_artwork_kind_check
    check (kind in (
      'marker','light','pin_theme','siegel','potion','rank',
      'base_theme','building','resource','chest','stronghold','nameplate',
      'ui_icon'
    ));
end $$;

-- ─── ui_icon_slots — Katalog der vom Admin pflegbaren Slots ───────────
-- Ermöglicht der Admin-UI, dynamisch alle UI-Icon-Slots aufzulisten
-- (statt sie hart im Frontend zu hinterlegen).
create table if not exists public.ui_icon_slots (
  id            text primary key,           -- z.B. "stat_attack", "class_infantry", "action_spy"
  category      text not null check (category in ('stat','class','action','badge','misc')),
  name          text not null,
  description   text not null,
  fallback_emoji text not null default '✨',
  sort          int  not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.ui_icon_slots enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ui_icon_slots' and policyname='ui_icon_slots_read') then
    create policy ui_icon_slots_read on public.ui_icon_slots for select using (true);
  end if;
end $$;

-- Seed-Slots (initial alle aktuell verwendeten Emojis)
insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  -- Kampf-Stats
  ('stat_troops',     'stat',   'Truppen-Stat',          'Symbol für Gesamt-Truppen-Anzahl in Stats-Karten',           '⚔️',  10),
  ('stat_attack',     'stat',   'Angriff-Stat',          'Symbol für Angriffsmacht',                                    '🗡️',  11),
  ('stat_defense',    'stat',   'Verteidigung-Stat',     'Symbol für Verteidigungsmacht',                               '🛡️',  12),
  ('stat_hp',         'stat',   'HP-Stat',               'Symbol für Base-HP',                                          '❤️',  13),
  ('stat_power',      'stat',   'Stärke-Stat',           'Symbol für Gesamt-Stärke (CoD-Style)',                        '💪',  14),
  -- Truppen-Klassen
  ('class_infantry',  'class',  'Türsteher-Klasse',      'Klassen-Icon für Infantry/Türsteher',                         '🛡️',  20),
  ('class_cavalry',   'class',  'Kuriere-Klasse',        'Klassen-Icon für Cavalry/Kuriere',                            '🏍️',  21),
  ('class_marksman',  'class',  'Schleuderer-Klasse',    'Klassen-Icon für Marksman/Schleuderer',                       '🎯',  22),
  ('class_siege',     'class',  'Brecher-Klasse',        'Klassen-Icon für Siege/Brecher',                              '🔨',  23),
  -- Action-Buttons
  ('action_spy',      'action', 'Spähen-Action',         'Button-Icon für Spionage/Späher',                             '🔍',  30),
  ('action_rally',    'action', 'Crew-Angriff-Action',   'Button-Icon für Versammeln/Crew-Angriff',                     '📣',  31),
  ('action_attack',   'action', 'Angriff-Action',        'Button-Icon für Solo-Angriff',                                '⚔️',  32),
  ('action_shield',   'action', 'Schild-Badge',          'Badge-Icon für aktiven Base-Schutzschild',                    '🛡️',  33)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
