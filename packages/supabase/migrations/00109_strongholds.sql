-- ══════════════════════════════════════════════════════════════════════════
-- SCHATTENHORTE — Map-POIs für Crew-Sammelangriffe
-- ══════════════════════════════════════════════════════════════════════════
-- Dunkle Festungen die als Crew-Versammlung angegriffen werden können.
-- Spawn alle ~6h pro PLZ-Region; Stufe 1–10; HP skaliert mit Stufe.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.strongholds (
  id              uuid primary key default gen_random_uuid(),
  plz             text not null,
  lat             double precision not null,
  lng             double precision not null,
  level           int  not null check (level between 1 and 10),
  total_hp        bigint not null,            -- "empfohlen X Einheiten Stufe Y"
  current_hp      bigint not null,
  spawned_at      timestamptz not null default now(),
  defeated_at     timestamptz,
  respawn_at      timestamptz,
  defeated_by_crew uuid references public.crews(id) on delete set null
);
create index if not exists idx_strongholds_plz on public.strongholds(plz);
create index if not exists idx_strongholds_active on public.strongholds(defeated_at) where defeated_at is null;

alter table public.strongholds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='strongholds' and policyname='select_all') then
    create policy select_all on public.strongholds for select using (true);
  end if;
end $$;
grant select on public.strongholds to anon, authenticated;

-- ─── HP-Formel: 100 × Stufe^2 (Lv 1=100, Lv 5=2.500, Lv 10=10.000) ──────
create or replace function public.stronghold_hp_for_level(p_level int)
returns bigint language sql immutable as $$
  select (100 * p_level * p_level)::bigint;
$$;

-- ─── Spawn-Helper: pro PLZ bis zu 5 aktive Strongholds, zufällige Lvl ────
create or replace function public.spawn_strongholds_for_plz(p_plz text, p_center_lat double precision, p_center_lng double precision)
returns int language plpgsql security definer as $$
declare
  v_active int;
  v_to_spawn int;
  v_jitter_lat double precision;
  v_jitter_lng double precision;
  v_lvl int;
  v_hp bigint;
  i int;
begin
  select count(*) into v_active from public.strongholds
   where plz = p_plz and defeated_at is null;
  v_to_spawn := greatest(0, 5 - v_active);
  for i in 1..v_to_spawn loop
    -- Zufalls-Jitter ±0.025° (~2.5 km)
    v_jitter_lat := (random() - 0.5) * 0.05;
    v_jitter_lng := (random() - 0.5) * 0.05;
    v_lvl := 1 + floor(random() * 10)::int;
    v_hp := public.stronghold_hp_for_level(v_lvl);
    insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
    values (p_plz, p_center_lat + v_jitter_lat, p_center_lng + v_jitter_lng, v_lvl, v_hp, v_hp);
  end loop;
  return v_to_spawn;
end $$;
revoke all on function public.spawn_strongholds_for_plz(text, double precision, double precision) from public;
grant execute on function public.spawn_strongholds_for_plz(text, double precision, double precision) to authenticated;

-- ─── Read-RPC: Strongholds in der Nähe (Bounding-Box) ────────────────────
create or replace function public.get_nearby_strongholds(p_lat double precision, p_lng double precision, p_radius_km numeric default 15)
returns jsonb language plpgsql security definer as $$
declare
  v_dlat double precision := p_radius_km / 111.0;
  v_dlng double precision := p_radius_km / (111.0 * cos(radians(p_lat)));
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'lat', lat, 'lng', lng,
      'plz', plz,
      'level', level,
      'total_hp', total_hp,
      'current_hp', current_hp,
      'hp_pct', case when total_hp > 0 then round(100.0 * current_hp / total_hp, 0) else 0 end,
      'respawn_at', respawn_at,
      'defeated_at', defeated_at
    ))
    from public.strongholds
    where defeated_at is null
      and lat between p_lat - v_dlat and p_lat + v_dlat
      and lng between p_lng - v_dlng and p_lng + v_dlng
  ), '[]'::jsonb);
end $$;
revoke all on function public.get_nearby_strongholds(double precision, double precision, numeric) from public;
grant execute on function public.get_nearby_strongholds(double precision, double precision, numeric) to authenticated, anon;

-- ─── Cron-fähig: respawn_strongholds — wenn defeated_at + 6h erreicht ────
create or replace function public.respawn_due_strongholds()
returns int language plpgsql security definer as $$
declare
  v_count int;
begin
  with respawned as (
    update public.strongholds
       set current_hp = total_hp,
           defeated_at = null, respawn_at = null,
           spawned_at = now(), defeated_by_crew = null
     where defeated_at is not null
       and respawn_at is not null
       and respawn_at <= now()
    returning id
  )
  select count(*) into v_count from respawned;
  return v_count;
end $$;
revoke all on function public.respawn_due_strongholds() from public;
grant execute on function public.respawn_due_strongholds() to authenticated;
