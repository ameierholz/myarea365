-- ══════════════════════════════════════════════════════════════════════════
-- Namensschilder (Nameplates) — Cosmetic-Slot ums Runner-Label auf der Karte
-- ══════════════════════════════════════════════════════════════════════════
-- Wie in Call of Dragons: PNG-Banner ums Namens-Tag mit Rarity + Effekt.
-- Greenscreen-PNG (chroma-keyed im Frontend) → liegt hinter dem Namens-Chip.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.nameplates (
  id              text primary key,
  name            text not null,
  description     text not null,
  rarity          text not null check (rarity in ('common','advanced','epic','legendary')),
  unlock_kind     text not null default 'free' check (unlock_kind in ('free','vip','coins','event','crew_level','achievement')),
  unlock_value    int  not null default 0,
  sort            int  not null default 0,
  preview_emoji   text not null default '🎀',  -- Fallback-Emoji bevor Artwork da ist
  -- Artwork-URLs werden über cosmetic_artwork (kind='nameplate') gepflegt
  is_active       boolean not null default true
);

alter table public.nameplates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='nameplates' and policyname='select_all') then
    create policy select_all on public.nameplates for select using (true);
  end if;
end $$;
grant select on public.nameplates to anon, authenticated;

-- ─── User-Inventar ──────────────────────────────────────────────────────
create table if not exists public.user_nameplates (
  user_id    uuid not null references auth.users(id) on delete cascade,
  nameplate_id text not null references public.nameplates(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, nameplate_id)
);

alter table public.user_nameplates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_nameplates' and policyname='select_own') then
    create policy select_own on public.user_nameplates for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_nameplates' and policyname='write_own') then
    create policy write_own on public.user_nameplates for insert with check (auth.uid() = user_id);
  end if;
end $$;
grant select, insert on public.user_nameplates to authenticated;

-- ─── Equip-Slot auf profiles ────────────────────────────────────────────
alter table public.profiles
  add column if not exists equipped_nameplate_id text references public.nameplates(id) on update cascade on delete set null;

-- ─── cosmetic_artwork.kind erweitern um 'nameplate' ─────────────────────
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
      'base_theme','building','resource','chest','stronghold','nameplate'
    ));
end $$;

-- ─── Seed-Nameplates ────────────────────────────────────────────────────
insert into public.nameplates (id, name, description, rarity, unlock_kind, unlock_value, sort, preview_emoji)
values
  ('default',     'Standard',         'Schlichter Rahmen ohne Effekt.',                  'common',    'free',    0, 0, '▫️'),
  ('snow',        'Schneetreiben',    'Schneeflocken-Wirbel mit Wolken-Banner.',         'advanced',  'event',   0, 10, '❄️'),
  ('floral',      'Blumenband',       'Pinkes Schleifen-Band mit Herzen.',               'epic',      'vip',     5, 20, '🎀'),
  ('royal',       'Königskrone',      'Goldene Krone + Blau-Gold-Heraldik.',             'legendary', 'vip',    12, 30, '👑'),
  ('dragon',      'Drachen-Banner',   'Geflügelte Drachen-Schwingen mit Flammen.',       'legendary', 'vip',    15, 31, '🐉'),
  ('frost_crown', 'Frost-Krone',      'Eiskristall-Krone mit gefrorenem Atem-Hauch.',    'epic',      'event',   0, 21, '🧊'),
  ('thorn_rose',  'Dornen-Rose',      'Schwarze Rose mit Dornen-Schlinge.',              'epic',      'vip',     8, 22, '🌹'),
  ('sunburst',    'Sonnen-Aureole',   'Goldene Sonnenstrahlen hinter dem Namen.',        'legendary', 'vip',    10, 32, '☀️'),
  ('streak_30',   'Streak-Champion',  'Kettenring — freigespielt durch 30-Tage-Streak.', 'epic',      'achievement', 30, 23, '🔥'),
  ('founder',     'Gründer-Banner',   'Limited Founders-Edition für die ersten 1000 Runner.', 'legendary', 'event', 0, 33, '⭐')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity,
  unlock_kind = excluded.unlock_kind, unlock_value = excluded.unlock_value,
  sort = excluded.sort, preview_emoji = excluded.preview_emoji;

-- Default-Nameplate wird jedem User automatisch zugewiesen (idempotent)
insert into public.user_nameplates (user_id, nameplate_id)
select id, 'default' from auth.users on conflict do nothing;

-- ─── RPC: equip_nameplate(text) ─────────────────────────────────────────
create or replace function public.equip_nameplate(p_nameplate_id text)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_owned boolean;
begin
  if v_user is null then return jsonb_build_object('error','unauthenticated'); end if;
  if p_nameplate_id is null then
    update public.profiles set equipped_nameplate_id = null where id = v_user;
    return jsonb_build_object('ok', true, 'nameplate_id', null);
  end if;
  select exists(select 1 from public.user_nameplates where user_id = v_user and nameplate_id = p_nameplate_id)
    into v_owned;
  if not v_owned then return jsonb_build_object('error','not_owned'); end if;
  update public.profiles set equipped_nameplate_id = p_nameplate_id where id = v_user;
  return jsonb_build_object('ok', true, 'nameplate_id', p_nameplate_id);
end $$;
revoke all on function public.equip_nameplate(text) from public;
grant execute on function public.equip_nameplate(text) to authenticated;

-- ─── RPC: claim_nameplate(text) — für freischaltbare Plates ────────────
create or replace function public.claim_nameplate(p_nameplate_id text)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_plate record;
begin
  if v_user is null then return jsonb_build_object('error','unauthenticated'); end if;
  select * into v_plate from public.nameplates where id = p_nameplate_id and is_active = true;
  if v_plate is null then return jsonb_build_object('error','not_found'); end if;
  -- Unlock-Logik (vereinfacht — freie + event sind sofort claimable)
  if v_plate.unlock_kind not in ('free','event','vip') then
    return jsonb_build_object('error','locked', 'requires', v_plate.unlock_kind);
  end if;
  insert into public.user_nameplates (user_id, nameplate_id) values (v_user, p_nameplate_id)
    on conflict do nothing;
  return jsonb_build_object('ok', true, 'nameplate_id', p_nameplate_id);
end $$;
grant execute on function public.claim_nameplate(text) to authenticated;
