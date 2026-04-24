-- Farb-Zerfall für Claims
-- ─────────────────────────────────────────────────────────────
-- Eroberte Straßen und Territorien verlieren jeden Tag 10 %
-- Farbintensität. Nach 10 Tagen ohne Repainting wird der Claim
-- wieder neutral (DELETE) und kann von jedem neu erobert werden.
-- Repainting: wenn der Owner die Straße/das Segment erneut
-- abläuft, wird last_painted_at auf now() gesetzt und die
-- Intensität springt zurück auf 100 %.

-- ─────────────────────────────────────────────────────────────
-- 1) Schema: last_painted_at
-- ─────────────────────────────────────────────────────────────

alter table public.territory_polygons
  add column if not exists last_painted_at timestamptz;

alter table public.streets_claimed
  add column if not exists last_painted_at timestamptz;

-- Backfill: bestehende Claims bekommen last_painted_at = created_at
update public.territory_polygons
   set last_painted_at = created_at
 where last_painted_at is null;

update public.streets_claimed
   set last_painted_at = created_at
 where last_painted_at is null;

-- NOT NULL erst nach Backfill
alter table public.territory_polygons
  alter column last_painted_at set not null,
  alter column last_painted_at set default now();

alter table public.streets_claimed
  alter column last_painted_at set not null,
  alter column last_painted_at set default now();

-- Indizes für Prune-Query und Frontend-Filter
create index if not exists idx_territory_polygons_last_painted
  on public.territory_polygons (last_painted_at);

create index if not exists idx_streets_claimed_last_painted
  on public.streets_claimed (last_painted_at);

-- ─────────────────────────────────────────────────────────────
-- 2) Intensity-Helper: live berechnet, keine gespeicherte Spalte
-- ─────────────────────────────────────────────────────────────
-- 100 am Tag des Paintings → -10 pro Tag → 0 nach 10 Tagen.
-- Frontend multipliziert Alpha-Channel der Crew-Farbe mit intensity/100.

create or replace function public.claim_intensity(painted_at timestamptz)
returns int
language sql
immutable
parallel safe
as $$
  select greatest(
    0,
    100 - (floor(extract(epoch from (now() - painted_at)) / 86400) * 10)::int
  )
$$;

comment on function public.claim_intensity is
  'Farbintensität eines Claims in Prozent (0-100), abgeleitet aus last_painted_at. 100 % am Tag 0, -10 % pro Tag, 0 % ab Tag 10.';

-- ─────────────────────────────────────────────────────────────
-- 3) Prune: Claims älter als 10 Tage entfernen
-- ─────────────────────────────────────────────────────────────
-- Vollständig neutralisierte Claims werden hard-deleted, damit
-- andere Runner die Straße/das Gebiet neu erobern können. Da
-- street_segments die Basis für Territory-Rekonstruktion sind,
-- bleiben diese erhalten (sonst wären Lauf-Statistiken verloren).

create or replace function public.prune_expired_claims()
returns table(territories_deleted bigint, streets_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t_count bigint;
  s_count bigint;
begin
  delete from public.territory_polygons
   where last_painted_at < now() - interval '10 days';
  get diagnostics t_count = row_count;

  delete from public.streets_claimed
   where last_painted_at < now() - interval '10 days';
  get diagnostics s_count = row_count;

  return query select t_count, s_count;
end;
$$;

grant execute on function public.prune_expired_claims() to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) Repaint: wenn Owner eigenen Claim neu abläuft
-- ─────────────────────────────────────────────────────────────
-- Wird von /api/walk/segments nach dem Run-Processing aufgerufen,
-- mit den street_names und segment_ids aus dem aktuellen Lauf.

create or replace function public.repaint_user_claims(
  p_user_id uuid,
  p_street_names text[],
  p_segment_ids uuid[]
)
returns table(streets_repainted bigint, territories_repainted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  s_count bigint := 0;
  t_count bigint := 0;
begin
  -- Straßen: wenn der User einen seiner claimed streets wieder abläuft
  if array_length(p_street_names, 1) > 0 then
    update public.streets_claimed
       set last_painted_at = now()
     where user_id = p_user_id
       and street_name = any(p_street_names);
    get diagnostics s_count = row_count;
  end if;

  -- Territorien: wenn irgendein Segment des neuen Laufs zu
  -- einem eigenen Territorium gehört, zählt das als Refresh.
  if array_length(p_segment_ids, 1) > 0 then
    update public.territory_polygons
       set last_painted_at = now()
     where claimed_by_user_id = p_user_id
       and segment_ids && p_segment_ids;
    get diagnostics t_count = row_count;
  end if;

  return query select s_count, t_count;
end;
$$;

grant execute on function public.repaint_user_claims(uuid, text[], uuid[]) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 5) pg_cron: tägliches Prune um 03:00 UTC
-- ─────────────────────────────────────────────────────────────
-- Unscheduled wenn pg_cron nicht verfügbar ist (lokale DB-Dumps
-- ohne Extension). Auf Produktion (Supabase Cloud) immer an.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- existing job abhängen, dann neu anlegen (idempotent)
    perform cron.unschedule('prune-expired-claims-daily')
      where exists (select 1 from cron.job where jobname = 'prune-expired-claims-daily');

    perform cron.schedule(
      'prune-expired-claims-daily',
      '0 3 * * *',
      $cron$ select public.prune_expired_claims(); $cron$
    );
  end if;
end $$;
