-- ══════════════════════════════════════════════════════════════════════════
-- Klassen-/Fraktions-Rework (Foundation)
-- ══════════════════════════════════════════════════════════════════════════
-- - Fraktionen: kronenwacht (👑 Establishment) / gossenbund (🗝️ Underdog)
--   jeweils mit mechanischem Buff
-- - Klassen: tank / support / ranged / melee (ersetzt infantry/cavalry/marksman/mage)
--   Altes `guardian_type`-Feld bleibt (legacy), NEUES `class_id` kommt dazu.
--   Mapping der 60 Archetypen auf class_id erfolgt in Follow-up-Migration.
-- - Siegel: Spalten werden gespiegelt (siegel_tank etc.) und synchron gehalten.
--   Alte Siegel-Spalten bleiben erstmal, bis UI komplett migriert ist.
-- - Counter-System (Stein-Schere-Papier):
--     Tank > Melee > Support > Ranged > Tank
-- - Items: bonus_hp_regen, bonus_mana, bonus_mana_regen als neue Spalten.
-- - user_guardians: max_mana, current_mana fuer Mana-Pool (inaktiv bis Engine-Update).
-- ══════════════════════════════════════════════════════════════════════════

-- ─── FRAKTIONEN ────────────────────────────────────────────────────────────
create table if not exists public.factions (
  id              text primary key,
  label           text not null,
  icon            text not null,
  color           text not null,
  buff_name       text not null,
  buff_desc       text not null,
  created_at      timestamptz not null default now()
);

insert into public.factions (id, label, icon, color, buff_name, buff_desc) values
  ('kronenwacht', 'Kronenwacht', '👑', '#FFD700',
   'Beständig',
   'Bonus-Wegemünzen für lange gehaltene Straßenzüge · deine Gebiete verblassen langsamer (Farb-Zerfall bremsen)'),
  ('gossenbund',  'Gossenbund',  '🗝️', '#22D1C3',
   'Raubzug',
   'Bonus-Wegemünzen beim Erobern neuer Straßen · übermalst gegnerische Straßen schneller')
on conflict (id) do update set
  label = excluded.label, icon = excluded.icon, color = excluded.color,
  buff_name = excluded.buff_name, buff_desc = excluded.buff_desc;

-- User-Spalte `faction` existiert bereits (public.users), Werte remappen:
-- alte Werte: nachtpuls, sonnenwacht, night_pulse, sun_watch, vanguard, syndicate
-- Mapping: vanguard/sonnenwacht → kronenwacht, syndicate/nachtpuls → gossenbund
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='faction') then
    update public.users set faction = 'kronenwacht'
      where faction in ('vanguard', 'sonnenwacht', 'sun_watch', 'sunwatch');
    update public.users set faction = 'gossenbund'
      where faction in ('syndicate', 'nachtpuls', 'night_pulse', 'nightpulse');
  end if;
end $$;

-- ─── KLASSEN ───────────────────────────────────────────────────────────────
create table if not exists public.guardian_classes (
  id              text primary key,  -- 'tank' | 'support' | 'ranged' | 'melee'
  label           text not null,
  icon            text not null,
  color           text not null,
  buff_name       text not null,
  buff_desc       text not null,
  counter_id      text,               -- diese Klasse schlaegt (1.25x vs counter_id)
  created_at      timestamptz not null default now()
);

insert into public.guardian_classes (id, label, icon, color, buff_name, buff_desc, counter_id) values
  ('tank',    'Tank',        '🛡️', '#60a5fa',
   'Bollwerk',
   '+20% DEF · +10% HP · −30% Schaden von Nahkaempfern',
   'melee'),
  ('support', 'Support',     '✨', '#a855f7',
   'Segen',
   'Heilt aktive Verbuendete +5% HP pro Runde · +15% Team-DEF-Aura',
   'ranged'),
  ('ranged',  'Fernkampf',   '🏹', '#4ade80',
   'Praezision',
   '+20% Krit-Chance · Erstschlag in Runde 1',
   'tank'),
  ('melee',   'Nahkampf',    '⚔️', '#FF6B4A',
   'Blutrausch',
   '+25% ATK · +10% SPD · Blutung 3 Runden (DoT)',
   'support')
on conflict (id) do update set
  label = excluded.label, icon = excluded.icon, color = excluded.color,
  buff_name = excluded.buff_name, buff_desc = excluded.buff_desc,
  counter_id = excluded.counter_id;

-- Archetype → Klasse (side-by-side mit legacy guardian_type)
alter table public.guardian_archetypes
  add column if not exists class_id text references public.guardian_classes(id) on update cascade on delete set null;

-- Soft-Mapping aus bestehenden guardian_type-Werten (best-effort bis Rename-Follow-up):
update public.guardian_archetypes
   set class_id = case guardian_type
     when 'infantry' then 'tank'
     when 'cavalry'  then 'melee'
     when 'marksman' then 'ranged'
     when 'mage'     then 'ranged'  -- Magier bleibt erstmal ranged; Support wird per Rename-Follow-up zugewiesen
     else null end
 where class_id is null;

create index if not exists idx_archetypes_class on public.guardian_archetypes(class_id);

-- ─── SIEGEL-REWORK (Spiegel-Spalten) ──────────────────────────────────────
-- Bestehende Spalten: siegel_infantry / siegel_cavalry / siegel_marksman / siegel_mage / siegel_universal
-- Neue Spalten (spiegeln, spaeter legacy droppen):
alter table public.user_siegel
  add column if not exists siegel_tank    int not null default 0,
  add column if not exists siegel_support int not null default 0,
  add column if not exists siegel_ranged  int not null default 0,
  add column if not exists siegel_melee   int not null default 0;

-- Einmaliger Backfill (Summen aus Legacy-Spalten ins neue Schema):
update public.user_siegel
   set siegel_tank    = coalesce(siegel_tank,    0) + coalesce(siegel_infantry, 0),
       siegel_melee   = coalesce(siegel_melee,   0) + coalesce(siegel_cavalry,  0),
       siegel_ranged  = coalesce(siegel_ranged,  0) + coalesce(siegel_marksman, 0) + coalesce(siegel_mage, 0),
       siegel_support = coalesce(siegel_support, 0)
 where greatest(coalesce(siegel_infantry,0),coalesce(siegel_cavalry,0),coalesce(siegel_marksman,0),coalesce(siegel_mage,0)) > 0;

-- ─── ITEMS: REGEN + MANA ───────────────────────────────────────────────────
alter table public.item_catalog
  add column if not exists bonus_hp_regen   int not null default 0,
  add column if not exists bonus_mana       int not null default 0,
  add column if not exists bonus_mana_regen int not null default 0;

-- ─── GUARDIAN MANA-POOL (passiv, Engine nutzt es spaeter) ──────────────────
alter table public.user_guardians
  add column if not exists max_mana     int not null default 0,
  add column if not exists current_mana int not null default 0;

-- ─── COUNTER-SYSTEM FUNKTION (neues Klassen-Set) ───────────────────────────
-- Tank > Melee > Support > Ranged > Tank
-- Rueckgabe: Multiplier fuer Attacker gegen Defender (1.25, 1.0, 0.75).
create or replace function public.class_counter(
  p_attacker text,
  p_defender text
) returns numeric language plpgsql immutable as $$
begin
  if p_attacker is null or p_defender is null then return 1.0; end if;
  if p_attacker = p_defender then return 1.0; end if;
  if (p_attacker, p_defender) in (
       ('tank',   'melee'),
       ('melee',  'support'),
       ('support','ranged'),
       ('ranged', 'tank')
     ) then return 1.25;
  end if;
  if (p_defender, p_attacker) in (
       ('tank',   'melee'),
       ('melee',  'support'),
       ('support','ranged'),
       ('ranged', 'tank')
     ) then return 0.75;
  end if;
  return 1.0;
end $$;

grant execute on function public.class_counter(text, text) to authenticated, anon;

-- ─── RLS fuer die neuen Meta-Tabellen ──────────────────────────────────────
alter table public.factions enable row level security;
alter table public.guardian_classes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='factions' and policyname='factions_read_all') then
    create policy factions_read_all on public.factions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='guardian_classes' and policyname='classes_read_all') then
    create policy classes_read_all on public.guardian_classes for select using (true);
  end if;
end $$;
