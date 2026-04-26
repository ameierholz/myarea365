-- ══════════════════════════════════════════════════════════════════════════
-- BASE-SYSTEM: Map-Pin statt Iso-Szene
-- ══════════════════════════════════════════════════════════════════════════
-- Pivot: Bases werden nicht mehr in einer eigenen Iso-Szene gerendert,
-- sondern als Pin auf der Dashboard-Karte. Click → Modal mit Tabs.
--
-- Was hier dazukommt:
--   - bases.lat/lng/visibility/theme_id (Runner setzt seinen Pin selbst)
--   - crew_bases.lat/lng/theme_id (Crew-Lead setzt Pin im PLZ-Cluster)
--   - base_themes (Mittelalter default + Skin-Slots für VIP/Monetarisierung)
--   - RPCs: set_base_position / set_base_visibility / set_base_theme
--   - get_bases_in_bbox(): liefert sichtbare Bases im Map-Viewport
--   - get_base_public(): liefert read-only View einer fremden Base
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Themes-Catalog ───────────────────────────────────────────────────
create table if not exists public.base_themes (
  id              text primary key,
  name            text not null,
  description     text not null,
  pin_emoji       text not null,             -- für simple Map-Pins
  pin_color       text not null,             -- Hex, z.B. #22D1C3
  accent_color    text not null,             -- Modal-Akzent
  modal_bg_url    text,                      -- optional, für Theme-Header
  resource_icon_wood  text not null default '🪵',
  resource_icon_stone text not null default '🪨',
  resource_icon_gold  text not null default '🪙',
  resource_icon_mana  text not null default '💧',
  unlock_kind     text not null default 'free' check (unlock_kind in ('free','vip','coins','event','crew_level')),
  unlock_value    int  not null default 0,   -- VIP-Tier, Coin-Preis, Crew-Lv usw.
  sort            int  not null default 0
);

insert into public.base_themes
  (id, name, description, pin_emoji, pin_color, accent_color,
   resource_icon_wood, resource_icon_stone, resource_icon_gold, resource_icon_mana,
   unlock_kind, unlock_value, sort)
values
  ('medieval',  'Mittelalter',     'Klassische Burg-Ästhetik. Default für alle.',
    '🏰', '#22D1C3', '#22D1C3', '🪵', '🪨', '🪙', '💧', 'free',  0,  0),
  ('scifi',     'Sci-Fi-Outpost',  'Plasma-Forge statt Schmiede. Energiezellen statt Holz.',
    '🛸', '#7C3AED', '#A78BFA', '⚡', '🔩', '💎', '🧪', 'vip',   5,  1),
  ('pirate',    'Pirat-Versteck',  'Versteckte Bucht mit Schatzkammern.',
    '🏴‍☠️','#FFD700','#FFD700','🪵','🪨','💰','🍶','vip',   3,  2),
  ('viking',    'Wikinger-Halle',  'Langhaus mit Met-Hörnern.',
    '⚔️', '#FF6B4A', '#FF6B4A', '🪵', '🪨', '🪙', '🐎', 'vip',  10,  3),
  ('ninja',     'Ninja-Dojo',      'Schattendojo, lautlos und tödlich.',
    '🥷', '#0F1115', '#22D1C3', '🎋', '🔪', '🪙', '🌙', 'crew_level', 5, 4),
  ('halloween', 'Halloween (saisonal)', 'Limited Halloween-Skin.',
    '🎃', '#FF8C00', '#FF8C00', '🦴', '🪦', '👻', '🧪', 'event', 0,  5)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  pin_emoji = excluded.pin_emoji, pin_color = excluded.pin_color,
  accent_color = excluded.accent_color, modal_bg_url = excluded.modal_bg_url,
  resource_icon_wood = excluded.resource_icon_wood,
  resource_icon_stone = excluded.resource_icon_stone,
  resource_icon_gold = excluded.resource_icon_gold,
  resource_icon_mana = excluded.resource_icon_mana,
  unlock_kind = excluded.unlock_kind, unlock_value = excluded.unlock_value,
  sort = excluded.sort;

alter table public.base_themes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_themes' and policyname='select_all') then
    create policy select_all on public.base_themes for select using (true);
  end if;
end $$;
grant select on public.base_themes to anon, authenticated;

-- ─── 2) bases erweitern ──────────────────────────────────────────────────
alter table public.bases
  add column if not exists lat        double precision,
  add column if not exists lng        double precision,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','crew','private')),
  add column if not exists theme_id   text not null default 'medieval'
    references public.base_themes(id) on update cascade,
  add column if not exists pin_label  text;

create index if not exists idx_bases_geo on public.bases(lat, lng) where lat is not null;
create index if not exists idx_bases_visibility on public.bases(visibility);

-- Andere User dürfen sichtbare Bases lesen (für Map + fremdes Modal).
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bases' and policyname='select_visible') then
    create policy select_visible on public.bases for select using (
      visibility = 'public'
      or owner_user_id = auth.uid()
      or (visibility = 'crew' and exists (
        select 1
        from public.crew_members me, public.crew_members other
        where me.user_id = auth.uid()
          and other.user_id = bases.owner_user_id
          and me.crew_id = other.crew_id
      ))
    );
  end if;
end $$;

-- ─── 3) crew_bases erweitern ─────────────────────────────────────────────
alter table public.crew_bases
  add column if not exists lat       double precision,
  add column if not exists lng       double precision,
  add column if not exists theme_id  text not null default 'medieval'
    references public.base_themes(id) on update cascade,
  add column if not exists pin_label text;

create index if not exists idx_crew_bases_geo on public.crew_bases(lat, lng) where lat is not null;

-- Crew-Bases sind generell öffentlich auf der Map (für Krieg/Sichtbarkeit).
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_bases' and policyname='select_all_public') then
    create policy select_all_public on public.crew_bases for select using (true);
  end if;
end $$;

-- ─── 4) RPC: set_base_position(lat, lng) ─────────────────────────────────
create or replace function public.set_base_position(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null then raise exception 'invalid_position'; end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'out_of_bounds';
  end if;
  v_id := public.get_or_create_base();
  update public.bases set lat = p_lat, lng = p_lng, updated_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'base_id', v_id, 'lat', p_lat, 'lng', p_lng);
end $$;

revoke all on function public.set_base_position(double precision, double precision) from public;
grant execute on function public.set_base_position(double precision, double precision) to authenticated;

-- ─── 5) RPC: set_base_visibility(text) ───────────────────────────────────
create or replace function public.set_base_visibility(p_visibility text)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_visibility not in ('public','crew','private') then raise exception 'invalid_visibility'; end if;
  update public.bases set visibility = p_visibility, updated_at = now()
    where owner_user_id = v_user;
  return jsonb_build_object('ok', true, 'visibility', p_visibility);
end $$;

revoke all on function public.set_base_visibility(text) from public;
grant execute on function public.set_base_visibility(text) to authenticated;

-- ─── 6) RPC: set_base_theme(text) ────────────────────────────────────────
create or replace function public.set_base_theme(p_theme_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_theme record;
  v_vip_level int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_theme from public.base_themes where id = p_theme_id;
  if v_theme is null then raise exception 'theme_not_found'; end if;

  -- Free-Themes immer ok; sonst gegen VIP prüfen (Coins/Event später)
  if v_theme.unlock_kind = 'vip' then
    select coalesce(vip_level, 0) into v_vip_level from public.vip_progress where user_id = v_user;
    if v_vip_level < v_theme.unlock_value then
      raise exception 'vip_level_too_low';
    end if;
  elsif v_theme.unlock_kind in ('coins','event','crew_level') then
    -- TODO: spätere Erweiterung; aktuell nur free + vip freigeschaltet
    raise exception 'theme_locked';
  end if;

  update public.bases set theme_id = p_theme_id, updated_at = now() where owner_user_id = v_user;
  return jsonb_build_object('ok', true, 'theme_id', p_theme_id);
end $$;

revoke all on function public.set_base_theme(text) from public;
grant execute on function public.set_base_theme(text) to authenticated;

-- ─── 7) RPC: set_crew_base_position(lat, lng) ────────────────────────────
-- Nur Crew-Lead darf die Crew-Base platzieren.
create or replace function public.set_crew_base_position(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_base_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null then raise exception 'invalid_position'; end if;

  select cm.crew_id, cm.role into v_crew, v_role
    from public.crew_members cm where cm.user_id = v_user limit 1;
  if v_crew is null then raise exception 'no_crew'; end if;
  if v_role not in ('owner','admin') then raise exception 'not_crew_lead'; end if;

  v_base_id := public.get_or_create_crew_base(v_crew);
  if v_base_id is null then raise exception 'crew_base_create_failed'; end if;
  update public.crew_bases set lat = p_lat, lng = p_lng, updated_at = now() where id = v_base_id;
  return jsonb_build_object('ok', true, 'crew_base_id', v_base_id, 'lat', p_lat, 'lng', p_lng);
end $$;

revoke all on function public.set_crew_base_position(double precision, double precision) from public;
grant execute on function public.set_crew_base_position(double precision, double precision) to authenticated;

-- ─── 8) RPC: get_bases_in_bbox() ─────────────────────────────────────────
-- Liefert alle sichtbaren Runner+Crew-Bases im aktuellen Map-Viewport.
-- min_lng/max_lng als West/Ost, min_lat/max_lat als Süd/Nord.
create or replace function public.get_bases_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns jsonb language plpgsql security definer as $$
declare v_runner jsonb; v_crew jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'runner',
    'id', b.id,
    'owner_user_id', b.owner_user_id,
    'lat', b.lat, 'lng', b.lng,
    'level', b.level,
    'theme_id', b.theme_id,
    'pin_label', coalesce(b.pin_label, u.display_name, 'Runner'),
    'is_own', (b.owner_user_id = auth.uid())
  )), '[]'::jsonb) into v_runner
  from public.bases b
  left join public.users u on u.id = b.owner_user_id
  where b.lat is not null and b.lng is not null
    and b.lat between p_min_lat and p_max_lat
    and b.lng between p_min_lng and p_max_lng;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'crew',
    'id', cb.id,
    'crew_id', cb.crew_id,
    'lat', cb.lat, 'lng', cb.lng,
    'level', cb.level,
    'theme_id', cb.theme_id,
    'pin_label', coalesce(cb.pin_label, c.name, 'Crew'),
    'is_own', exists (select 1 from public.crew_members m where m.crew_id = cb.crew_id and m.user_id = auth.uid())
  )), '[]'::jsonb) into v_crew
  from public.crew_bases cb
  left join public.crews c on c.id = cb.crew_id
  where cb.lat is not null and cb.lng is not null
    and cb.lat between p_min_lat and p_max_lat
    and cb.lng between p_min_lng and p_max_lng;

  return jsonb_build_object('ok', true, 'runner', v_runner, 'crew', v_crew);
end $$;

revoke all on function public.get_bases_in_bbox(double precision, double precision, double precision, double precision) from public;
grant execute on function public.get_bases_in_bbox(double precision, double precision, double precision, double precision) to anon, authenticated;

-- ─── 9) RPC: get_base_public(base_id) — read-only View einer fremden Base
create or replace function public.get_base_public(p_base_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_base record; v_buildings jsonb; v_owner record;
begin
  select * into v_base from public.bases where id = p_base_id;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- Visibility-Check (gleiche Logik wie RLS)
  if v_base.visibility = 'private' and v_base.owner_user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'private');
  end if;
  if v_base.visibility = 'crew' and v_base.owner_user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    if not exists (
      select 1 from public.crew_members me, public.crew_members other
      where me.user_id = auth.uid()
        and other.user_id = v_base.owner_user_id
        and me.crew_id = other.crew_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'crew_only');
    end if;
  end if;

  select jsonb_agg(jsonb_build_object(
    'building_id', bb.building_id, 'level', bb.level,
    'name', bc.name, 'emoji', bc.emoji
  )) into v_buildings
  from public.base_buildings bb
  join public.buildings_catalog bc on bc.id = bb.building_id
  where bb.base_id = p_base_id;

  select display_name, avatar_url into v_owner from public.users where id = v_base.owner_user_id;

  return jsonb_build_object(
    'ok', true,
    'base', jsonb_build_object(
      'id', v_base.id, 'level', v_base.level, 'plz', v_base.plz,
      'theme_id', v_base.theme_id, 'pin_label', v_base.pin_label,
      'lat', v_base.lat, 'lng', v_base.lng
    ),
    'owner', jsonb_build_object('display_name', v_owner.display_name, 'avatar_url', v_owner.avatar_url),
    'buildings', coalesce(v_buildings, '[]'::jsonb)
  );
end $$;

revoke all on function public.get_base_public(uuid) from public;
grant execute on function public.get_base_public(uuid) to anon, authenticated;
