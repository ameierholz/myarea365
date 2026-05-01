-- ══════════════════════════════════════════════════════════════════════════
-- Cosmetic-Erweiterung: Base-Rings (NEU, 20) + Nameplates (+10 → 20) +
-- Loot-Drops als artwork-kind (5 Rarities)
-- ══════════════════════════════════════════════════════════════════════════
-- Trennt sauber: Base-Theme (Gebäude) vs. Base-Ring (Aura/Donut um den Pin)
-- vs. Banner (Namensschild). Banner-Artworks haben freie Mitte für Runner-Name.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) base_rings Tabelle + Seed ───────────────────────────────────────
create table if not exists public.base_rings (
  id              text primary key,
  name            text not null,
  description     text not null,
  rarity          text not null check (rarity in ('common','advanced','epic','legendary')),
  unlock_kind     text not null default 'free' check (unlock_kind in ('free','vip','coins','event','crew_level','achievement')),
  unlock_value    int  not null default 0,
  sort            int  not null default 0,
  preview_emoji   text not null default '⭕',
  preview_color   text not null default '#22D1C3',
  is_active       boolean not null default true
);

alter table public.base_rings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_rings' and policyname='select_all') then
    create policy select_all on public.base_rings for select using (true);
  end if;
end $$;
grant select on public.base_rings to anon, authenticated;

insert into public.base_rings (id, name, description, rarity, unlock_kind, unlock_value, sort, preview_emoji, preview_color)
values
  ('default',          'Standard',           'Schlichter Glow-Ring um die Base.',                              'common',    'free',    0,  0,  '⭕', '#22D1C3'),
  ('iron',             'Eisenring',          'Schwerer Eisen-Reif mit Nieten — solide Basis.',                  'common',    'free',    0,  1,  '⚙️', '#9aa3b8'),
  ('emerald',          'Smaragd-Halo',       'Leuchtend grüner Edelstein-Ring mit Pflanzenranken.',            'advanced',  'vip',     2,  10, '💚', '#22D1C3'),
  ('frost',            'Frost-Halo',         'Eiskristalle wachsen aus dem Ring, kalter blauer Schimmer.',     'advanced',  'event',   0,  11, '❄️', '#5ddaf0'),
  ('golden',           'Gold-Reif',          'Massiver Goldring mit Punzierungen — Premium-Statussymbol.',      'advanced',  'vip',     5,  12, '👑', '#FFD700'),
  ('thorn',            'Dornenring',         'Verdrehte schwarze Dornenranken mit roten Tropfen.',             'epic',      'vip',     6,  20, '🌹', '#8B0000'),
  ('flame',            'Flammenring',        'Lodernde Flammen tanzen entlang des Rings, orange-gelb.',        'epic',      'vip',     8,  21, '🔥', '#FF6B00'),
  ('plasma',           'Plasma-Ring',        'Pulsierende Energie-Adern in Magenta mit Cyan-Sparks.',          'epic',      'vip',     8,  22, '⚡', '#FF2D78'),
  ('crystal',          'Kristall-Ring',      'Geschliffene Edelstein-Splitter im Hexagon-Muster.',             'epic',      'vip',     10, 23, '💎', '#a855f7'),
  ('shadow',           'Schattenring',       'Tiefschwarzer Ring der Licht zu schlucken scheint.',             'epic',      'vip',     9,  24, '🌑', '#1a1a2e'),
  ('lightning',        'Blitzring',          'Zuckende Stromschläge umkreisen die Base unaufhörlich.',         'epic',      'vip',     10, 25, '⚡', '#FFEE00'),
  ('coral',            'Korallen-Ring',      'Maritimer Korallen-Reif mit Perlen und Seetang.',                 'epic',      'event',   0,  26, '🐚', '#FF6B4A'),
  ('nebula',           'Nebula-Ring',        'Kosmische Wirbel in Violett und Blau mit Sterndust.',            'legendary', 'vip',     12, 30, '🌌', '#7c3aed'),
  ('dragon',           'Drachenring',        'Geflügelte Drachen-Schwingen formen den Ring, Goldglut.',        'legendary', 'vip',     15, 31, '🐉', '#FF4500'),
  ('solar',            'Sonnenring',         'Goldene Sonnenstrahlen explodieren nach außen — heroisch.',     'legendary', 'vip',     14, 32, '☀️', '#FFD700'),
  ('lunar',            'Mondring',           'Silberner Halbmond mit Nachthimmel und funkelnden Sternen.',     'legendary', 'vip',     14, 33, '🌙', '#C0C0FF'),
  ('void',             'Leere-Ring',         'Schwarzes Loch verzerrt das Licht — unheimliche Eleganz.',       'legendary', 'vip',     15, 34, '🌀', '#5a3aa8'),
  ('prismatic',        'Prisma-Ring',        'Rotierender Regenbogen-Refraktor — alle Farben gleichzeitig.',   'legendary', 'vip',     16, 35, '💠', '#FF00FF'),
  ('phoenix',          'Phönix-Ring',        'Lodernde goldene Federn, eingebrannt mit Glut-Asche.',           'legendary', 'achievement', 50, 36, '🔥', '#FFAC33'),
  ('founders',         'Gründer-Ring',       'Limited Edition für die ersten 1000 Runner — niemals erneut.',  'legendary', 'event',   0,  37, '⭐', '#FFD700')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity,
  unlock_kind = excluded.unlock_kind, unlock_value = excluded.unlock_value,
  sort = excluded.sort, preview_emoji = excluded.preview_emoji, preview_color = excluded.preview_color;

-- ─── 2) user_base_rings Inventar ────────────────────────────────────────
create table if not exists public.user_base_rings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  ring_id    text not null references public.base_rings(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, ring_id)
);

alter table public.user_base_rings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_base_rings' and policyname='select_own') then
    create policy select_own on public.user_base_rings for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_base_rings' and policyname='write_own') then
    create policy write_own on public.user_base_rings for insert with check (auth.uid() = user_id);
  end if;
end $$;
grant select, insert on public.user_base_rings to authenticated;

-- ─── 3) Equipped-Slot auf users ─────────────────────────────────────────
alter table public.users
  add column if not exists equipped_base_ring_id text references public.base_rings(id) on update cascade on delete set null;

-- Default-Ring für alle bestehenden User
insert into public.user_base_rings (user_id, ring_id)
select id, 'default' from auth.users on conflict do nothing;

update public.users set equipped_base_ring_id = 'default' where equipped_base_ring_id is null;

-- ─── 4) RPC: set_base_ring (equip) + claim_base_ring ────────────────────
create or replace function public.set_base_ring(p_ring_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid := auth.uid(); v_owned boolean;
begin
  if v_user is null then return jsonb_build_object('error','not_authenticated'); end if;
  select exists(select 1 from public.user_base_rings where user_id=v_user and ring_id=p_ring_id) into v_owned;
  if not v_owned then return jsonb_build_object('error','not_owned'); end if;
  update public.users set equipped_base_ring_id = p_ring_id where id = v_user;
  return jsonb_build_object('ok', true, 'equipped_ring_id', p_ring_id);
end $$;

create or replace function public.claim_base_ring(p_ring_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid := auth.uid(); v_ring record;
begin
  if v_user is null then return jsonb_build_object('error','not_authenticated'); end if;
  select * into v_ring from public.base_rings where id = p_ring_id and is_active = true;
  if v_ring.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_ring.unlock_kind not in ('free','event','vip') then
    return jsonb_build_object('error','locked', 'requires', v_ring.unlock_kind);
  end if;
  insert into public.user_base_rings (user_id, ring_id) values (v_user, p_ring_id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'ring_id', p_ring_id);
end $$;

grant execute on function public.set_base_ring(text) to authenticated;
grant execute on function public.claim_base_ring(text) to authenticated;

-- ─── 5) Nameplates: +10 neue → 20 total ─────────────────────────────────
insert into public.nameplates (id, name, description, rarity, unlock_kind, unlock_value, sort, preview_emoji)
values
  ('silver_wing',   'Silberflügel',         'Silberne Flügel rahmen den Namen — elegant und schnell.',          'advanced',  'vip',         3,  11, '🪽'),
  ('inferno',       'Inferno-Banner',       'Lodernde Glut-Adern mit fallender Asche.',                          'epic',      'vip',         8,  24, '🔥'),
  ('ocean_wave',    'Meereswelle',          'Türkise Wellen mit Schaumkronen und Möwen-Silhouette.',             'advanced',  'vip',         4,  12, '🌊'),
  ('arcane_scroll', 'Arkane Schriftrolle',  'Pergament-Rolle mit leuchtenden Runen-Inschriften.',                'epic',      'vip',         7,  25, '📜'),
  ('samurai',       'Samurai-Klinge',       'Gekreuzte Katanas mit Kirschblüten und rotem Hintergrund.',        'epic',      'vip',         9,  26, '⚔️'),
  ('cyber_glitch',  'Cyber-Glitch',         'Pixel-Distortion mit Neon-Magenta und Cyan-Scan-Lines.',            'epic',      'event',       0,  27, '💾'),
  ('galaxy',        'Galaxie-Band',         'Sternennebel mit Planeten-Orbits — kosmische Tiefe.',              'legendary', 'vip',         12, 34, '🌌'),
  ('emerald_vines', 'Smaragdranken',        'Lebende grüne Ranken mit goldenen Blüten.',                          'advanced',  'vip',         5,  13, '🌿'),
  ('phoenix',       'Phönix-Schwingen',     'Lodernde Phönix-Flügel rahmen den Namen ein.',                       'legendary', 'vip',         14, 35, '🦅'),
  ('starforged',    'Sterngeschmiedet',     'Geschmiedet aus Sternenstahl — freigespielt durch 100 Siege.',     'legendary', 'achievement', 100, 36, '🌟')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity,
  unlock_kind = excluded.unlock_kind, unlock_value = excluded.unlock_value,
  sort = excluded.sort, preview_emoji = excluded.preview_emoji;

-- ─── 6) cosmetic_artwork.kind erweitern: + base_ring, + loot_drop ───────
do $$
declare con_name text;
begin
  select conname into con_name from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'cosmetic_artwork' and c.conname = 'cosmetic_artwork_kind_check';
  if con_name is not null then
    execute 'alter table public.cosmetic_artwork drop constraint ' || quote_ident(con_name);
  end if;
  alter table public.cosmetic_artwork
    add constraint cosmetic_artwork_kind_check check (kind in (
      'marker','light','pin_theme','siegel','potion','rank',
      'base_theme','building','resource','chest','stronghold','nameplate',
      'ui_icon','troop',
      'base_ring','loot_drop','resource_node'
    ));
end $$;
