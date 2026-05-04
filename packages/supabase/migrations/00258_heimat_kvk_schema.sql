-- ════════════════════════════════════════════════════════════════════
-- HEIMAT-KARTE: CoD-UX Schema-Erweiterungen
-- ════════════════════════════════════════════════════════════════════
-- Erweitert Heimat-Karte (Dashboard-Map) auf Saga-KvK-Niveau:
-- - Multi-Aufgebot (N parallele Angriffs-Märsche)
-- - Marsch-Umleitung (Drag-Redirect)
-- - Verstecken in Gebäuden (Garrisons auf Heimat-Karte)
-- - Base-Verlegen v2 (Cooldown + History + ohne Token-Zwang)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) bases: Cooldown für Verlegen ──────────────────────────────────
alter table public.bases
  add column if not exists last_relocate_at timestamptz,
  add column if not exists relocate_count int not null default 0;

create table if not exists public.base_relocate_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  from_lat double precision not null,
  from_lng double precision not null,
  to_lat double precision not null,
  to_lng double precision not null,
  distance_m int not null,
  cost_paid jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ix_brh_user on public.base_relocate_history (user_id, created_at desc);
alter table public.base_relocate_history enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_relocate_history' and policyname='brh_read_own') then
    create policy brh_read_own on public.base_relocate_history
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 2) player_base_attacks: Multi-Aufgebot + Redirect ────────────────
alter table public.player_base_attacks
  add column if not exists legion_label text,
  add column if not exists guardian_id uuid,
  add column if not exists redirect_count int not null default 0,
  add column if not exists original_target_lat double precision,
  add column if not exists original_target_lng double precision,
  add column if not exists original_defender_id uuid;

-- Index für Viewport-Query (eingehende Angriffe + sichtbare Märsche)
create index if not exists ix_pba_pending on public.player_base_attacks (resolved_at, ends_at)
  where resolved_at is null;
create index if not exists ix_pba_geo_target on public.player_base_attacks (defender_lat, defender_lng)
  where resolved_at is null;

-- ─── 3) base_marches: Generischer Multi-Marsch-Tracker ────────────────
-- Ein Eintrag pro aktiver Legion (für UI-Anzeige + Sprite-Rendering).
-- Wird automatisch aus player_base_attacks/rallies/scouts/gather_marches
-- materialisiert per View, KEINE separate Tabelle nötig.
create or replace view public.base_active_marches_v as
  select
    'attack'::text as kind,
    pba.id::text as id,
    pba.attacker_user_id as user_id,
    null::uuid as crew_id,
    pba.defender_user_id as target_user_id,
    pba.attacker_lat as origin_lat,
    pba.attacker_lng as origin_lng,
    pba.defender_lat as target_lat,
    pba.defender_lng as target_lng,
    pba.starts_at,
    pba.ends_at,
    null::timestamptz as returns_at,
    'marching'::text as status,
    pba.troops_committed as troops,
    pba.guardian_id,
    pba.legion_label,
    pba.redirect_count
  from public.player_base_attacks pba
  where pba.resolved_at is null
    and pba.ends_at > now();

grant select on public.base_active_marches_v to authenticated;

-- ─── 4) base_garrisons: Truppen in Gebäuden verstecken ────────────────
-- target_kind: 'base' | 'crew_repeater' | 'wegelager' | 'mega_repeater'
-- target_id: jeweilige PK der Quelle
create table if not exists public.base_garrisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('base','crew_repeater','wegelager','mega_repeater')),
  target_id uuid,
  target_lat double precision not null,
  target_lng double precision not null,
  troops jsonb not null,
  guardian_id uuid,
  hp_remaining int,
  hidden_at timestamptz not null default now(),
  released_at timestamptz,
  released_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ix_bg_user_active on public.base_garrisons (user_id) where released_at is null;
create index if not exists ix_bg_target_active on public.base_garrisons (target_kind, target_id) where released_at is null;
create index if not exists ix_bg_geo_active on public.base_garrisons (target_lat, target_lng) where released_at is null;

alter table public.base_garrisons enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_garrisons' and policyname='bg_read_own') then
    create policy bg_read_own on public.base_garrisons
      for select using (auth.uid() = user_id);
  end if;
  -- Crew-Member sehen Garrisons ihrer Crew (für Verteidigungs-Anzeige)
  if not exists (select 1 from pg_policies where tablename='base_garrisons' and policyname='bg_read_crew') then
    create policy bg_read_crew on public.base_garrisons
      for select using (
        exists (
          select 1 from public.crew_members cm1
          join public.crew_members cm2 on cm1.crew_id = cm2.crew_id
          where cm1.user_id = base_garrisons.user_id
            and cm2.user_id = auth.uid()
        )
      );
  end if;
end $$;

comment on table public.base_garrisons is
  'Heimat-Karte: Truppen die ein Runner in einem Gebäude versteckt (eigene Base, Crew-Repeater, Wegelager, Mega-Repeater). Werden bei Angriff aufs Gebäude verteidigend eingesetzt.';

-- ─── 5) march_redirects: Audit-Log für Drag-Redirect ──────────────────
create table if not exists public.march_redirects (
  id uuid primary key default gen_random_uuid(),
  attack_id uuid not null references public.player_base_attacks(id) on delete cascade,
  user_id uuid not null,
  from_target_lat double precision not null,
  from_target_lng double precision not null,
  to_target_lat double precision not null,
  to_target_lng double precision not null,
  new_ends_at timestamptz not null,
  friction_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ix_mr_attack on public.march_redirects (attack_id, created_at desc);
alter table public.march_redirects enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='march_redirects' and policyname='mr_read_own') then
    create policy mr_read_own on public.march_redirects
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 6) march_capacity: Existierende Funktion bleibt (1-5 Slots) ──────
-- Multi-Aufgebot nutzt die bestehende march_queue-Cap aus get_march_caps().
-- Kein Schema-Change hier nötig.
