-- 00047: Stripe-Webhook-Idempotenz + Walks-Retention + Receipt-TTL.
-- Adressiert Security-Audit #1 (Webhook replay) und DSGVO-Audit #H2 / #H4.

-- ═══════════════════════════════════════════════════════
-- 1) Idempotency-Table für Stripe-Events
-- ═══════════════════════════════════════════════════════
-- Stripe retried bis zu 3×. Ohne diesen Guard würden Gems/Slots/Subscriptions
-- mehrfach gutgeschrieben.
create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text,
  processed_at timestamptz not null default now()
);

alter table public.stripe_processed_events enable row level security;
-- Keine Public-Policies — nur Service-Role schreibt/liest.

-- Auto-Cleanup: Events älter als 30 Tage entfernen (Stripe-Retry-Window ist 72 h).
create or replace function public.cleanup_stripe_processed_events()
returns int language plpgsql security definer as $$
declare v_count int;
begin
  delete from public.stripe_processed_events
  where processed_at < now() - interval '30 days'
  returning 1 into v_count;
  return coalesce(v_count, 0);
end $$;

grant execute on function public.cleanup_stripe_processed_events() to service_role;

-- ═══════════════════════════════════════════════════════
-- 2) GPS-Retention für walks.route (DSGVO-Zusage: 24 Monate)
-- ═══════════════════════════════════════════════════════
-- Bestehende Spalte walks.route ist ein LineString mit Roh-GPS. Nach 24 Monaten
-- entfernen wir die Geometrie, behalten aber Aggregat-Stats (distance_m, duration_s)
-- für Lifetime-Achievements.
create or replace function public.purge_old_walk_routes()
returns int language plpgsql security definer as $$
declare v_count int := 0;
begin
  update public.walks
  set route = null
  where created_at < now() - interval '24 months'
    and route is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.purge_old_walk_routes() to service_role;

comment on function public.purge_old_walk_routes is
  'DSGVO-Retention: löscht rohe GPS-LineStrings nach 24 Monaten, behält Aggregat-Stats.';

-- ═══════════════════════════════════════════════════════
-- 3) pg_cron Schedule (falls pg_cron verfügbar)
-- ═══════════════════════════════════════════════════════
-- Täglich 03:00 Europe/Berlin. Fallback: Vercel-Cron-Job kann denselben Call triggern.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-walk-routes',
      '0 3 * * *',
      $cron$ select public.purge_old_walk_routes(); $cron$
    );
    perform cron.schedule(
      'cleanup-stripe-events',
      '30 3 * * *',
      $cron$ select public.cleanup_stripe_processed_events(); $cron$
    );
  end if;
end $$;
