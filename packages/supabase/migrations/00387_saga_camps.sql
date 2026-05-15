-- 00387_saga_camps.sql
-- RoK-Style: 4 Camps pro Bracket (Fire/Forest/Sky/Sun-Analog). Jedes Quartier
-- gehört zu einem Camp, jede Crew spawnt in einem Camp. Camp-Grenzen werden
-- durch Barrier-Zonen markiert (sichtbare Mauer/Wall, später durchbrechbar).

-- ── saga_camps ────────────────────────────────────────────────────────────
create table if not exists public.saga_camps (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  camp_index int not null check (camp_index between 0 and 3),
  name text not null,
  color_hex text not null,
  barrier_theme text not null default 'wall',   -- 'wall' | 'river' | 'autobahn' | 'rail'
  apex_path_unlocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (bracket_id, camp_index)
);

create index if not exists idx_saga_camps_bracket on public.saga_camps(bracket_id);

alter table public.saga_camps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_camps' and policyname='saga_camps_public_read') then
    create policy saga_camps_public_read on public.saga_camps for select using (true);
  end if;
end $$;

-- ── saga_zones.camp_id: zu welchem Camp gehört diese Zone ──────────────────
alter table public.saga_zones
  add column if not exists camp_id uuid references public.saga_camps(id) on delete set null;

create index if not exists idx_saga_zones_camp on public.saga_zones(camp_id);

-- ── saga_bracket_crews.camp_id: in welchem Camp spawnt diese Crew ─────────
alter table public.saga_bracket_crews
  add column if not exists camp_id uuid references public.saga_camps(id) on delete set null;

-- ── Barrier-Zonen: neuer zone_kind 'barrier' ──────────────────────────────
-- Existierende Check-Constraint erweitern
do $$ begin
  alter table public.saga_zones drop constraint if exists saga_zones_zone_kind_check;
  alter table public.saga_zones add constraint saga_zones_zone_kind_check
    check (zone_kind in ('district','spawn','apex','gate','barrier'));
end $$;

-- Barrier-Eigenschaften (re-use von gate_state Pattern):
--   gate_state = 'closed' → undurchlässig
--   gate_state = 'open'   → Barrier ist durchbrochen, freier Durchgang
-- Optional für Spätere: barrier_hp/max_hp wenn man's einbauen will.

-- ── Adjacency-Erweiterung: Barrier-Zone als Mittler-Knoten ────────────────
-- saga_zone_adjacency.via_gate_zone akzeptiert jetzt auch barrier-Zonen.
-- Das vorhandene FK auf saga_zones reicht — keine Schema-Änderung nötig.
