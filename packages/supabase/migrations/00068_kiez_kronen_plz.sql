-- Kiez-Kronen: wöchentliches km-Leaderboard pro PLZ.
-- ─────────────────────────────────────────────────────────────
-- Die PLZ pro Segment wird asynchron via Nominatim-Reverse-Geocoding
-- aufgelöst (nicht hier; siehe apps/web/src/app/api/cron/resolve-plz).
-- Diese Migration stellt nur das Schema + die Aggregations-Views bereit.

-- ─────────────────────────────────────────────────────────────
-- 1) PLZ auf street_segments
-- ─────────────────────────────────────────────────────────────

alter table public.street_segments
  add column if not exists plz text
    check (plz is null or plz ~ '^[0-9]{5}$');

create index if not exists idx_street_segments_plz
  on public.street_segments (plz) where plz is not null;

-- Teilindex für den Cron-Job: schnell die nächsten unaufgelösten Segmente finden
create index if not exists idx_street_segments_plz_pending
  on public.street_segments (created_at) where plz is null;

-- ─────────────────────────────────────────────────────────────
-- 2) Street-Name → PLZ Cache (reduziert Nominatim-Calls dramatisch)
-- ─────────────────────────────────────────────────────────────
-- Zweite Lauf-Kilometer durch dieselbe Straße müssen nie wieder reverse-
-- geocoded werden. Key ist normalized street_name (lower, trimmed).

create table if not exists public.street_plz_cache (
  street_name_norm text primary key,
  plz text not null check (plz ~ '^[0-9]{5}$'),
  sample_lat numeric,
  sample_lng numeric,
  resolved_at timestamptz not null default now()
);

alter table public.street_plz_cache enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'street_plz_cache' and policyname = 'plz_cache_public_read') then
    create policy plz_cache_public_read on public.street_plz_cache for select using (true);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3) Wöchentliche km-Aggregation pro User pro PLZ
-- ─────────────────────────────────────────────────────────────
-- date_trunc('week', ...) nutzt ISO-8601 (Montag als Wochenstart).

create or replace view public.weekly_plz_km as
  select
    s.user_id,
    s.plz,
    date_trunc('week', s.created_at)::date as week_start,
    sum(s.length_m)::bigint as total_m,
    count(*)::int as segments_count
  from public.street_segments s
  where s.plz is not null
  group by s.user_id, s.plz, date_trunc('week', s.created_at);

comment on view public.weekly_plz_km is
  'Kilometer pro User pro PLZ pro ISO-Kalenderwoche. Basis für Kiez-Kronen-Ranking.';

-- ─────────────────────────────────────────────────────────────
-- 4) Aktuelle Kiez-Könige
-- ─────────────────────────────────────────────────────────────
-- Für jede PLZ der User mit den meisten km in der LETZTEN ABGESCHLOSSENEN
-- Woche. Diese User tragen die Krone bis zum nächsten Montag 00:00.

create or replace view public.current_plz_kings as
  with last_week as (
    select (date_trunc('week', now() - interval '7 days'))::date as week_start
  )
  select distinct on (w.plz)
    w.plz,
    w.user_id,
    w.total_m,
    w.segments_count,
    w.week_start
  from public.weekly_plz_km w, last_week lw
  where w.week_start = lw.week_start
  order by w.plz, w.total_m desc;

comment on view public.current_plz_kings is
  'Für jede PLZ der Top-Runner der letzten abgeschlossenen Woche — trägt die Krone diese Woche.';

-- ─────────────────────────────────────────────────────────────
-- 5) Convenience-View: Krone pro User
-- ─────────────────────────────────────────────────────────────
-- Damit das Frontend in einem einfachen Lookup „trägt User X eine Krone, und
-- wenn ja in welcher PLZ?" beantworten kann.

create or replace view public.user_crown_plzs as
  select
    user_id,
    array_agg(plz order by plz) as crown_plzs
  from public.current_plz_kings
  group by user_id;

grant select on public.weekly_plz_km      to authenticated, anon;
grant select on public.current_plz_kings  to authenticated, anon;
grant select on public.user_crown_plzs    to authenticated, anon;
