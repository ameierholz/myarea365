-- 00049: RLS-Policies für territories fixen.
--
-- Symptom: walks werden angelegt (distance_m, duration_s, street_name, route
-- werden gespeichert), aber der nachfolgende UPDATE auf xp_earned /
-- segments_claimed / streets_claimed / polygons_claimed schlägt RLS-silent
-- fehl — Benutzer sieht „+0 XP" bei jedem Lauf.
--
-- Ursache: ältere Migration(en) haben entweder keine oder nur eine
-- Insert-Policy angelegt. Unter RLS blockt fehlende Update-Policy den
-- Update ohne Fehlermeldung (0 Rows affected).
--
-- Fix: idempotent sicherstellen, dass Insert/Select/Update-Policies
-- für eigene Rows existieren.

-- RLS muss an sein.
alter table public.territories enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'territories' and policyname = 'territories_select_own'
  ) then
    create policy territories_select_own on public.territories
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'territories' and policyname = 'territories_insert_own'
  ) then
    create policy territories_insert_own on public.territories
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'territories' and policyname = 'territories_update_own'
  ) then
    create policy territories_update_own on public.territories
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Sanity-Test beim Migrations-Run: schreibbar?
comment on table public.territories is
  'Walk-Events (jede Zeile = 1 Lauf). RLS: eigene Rows select/insert/update.';
