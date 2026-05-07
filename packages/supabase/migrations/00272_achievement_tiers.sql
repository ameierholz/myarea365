-- Trophäen-Tier-System: Bronze/Silber/Gold pro Achievement
-- Bisher: keine Tier-Spalte → User-Trio im UI war fake-Split.
-- Jetzt: jedes Achievement bekommt explizit einen Tier, User-Trio aus echtem Join.

create type public.achievement_tier as enum ('bronze', 'silver', 'gold');

alter table public.achievements
  add column tier public.achievement_tier not null default 'bronze';

create index if not exists achievements_tier_idx on public.achievements(tier);

-- Convenience-RPC: zählt unlocked Achievements pro Tier für gegebenen User.
-- Nimmt User aus auth.uid() — Aufruf ohne Parameter, RLS sicher.
create or replace function public.user_achievement_tier_counts(p_user uuid default auth.uid())
returns table (
  bronze_count int,
  silver_count int,
  gold_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where a.tier = 'bronze')::int as bronze_count,
    count(*) filter (where a.tier = 'silver')::int as silver_count,
    count(*) filter (where a.tier = 'gold')::int   as gold_count
  from public.user_achievements ua
  join public.achievements a on a.id = ua.achievement_id
  where ua.user_id = p_user;
$$;

grant execute on function public.user_achievement_tier_counts(uuid) to authenticated, anon;

comment on column public.achievements.tier is
  'Trophäen-Stufe: bronze (Standard, einfache Erfolge), silver (mittel), gold (besondere Meilensteine).';
comment on function public.user_achievement_tier_counts(uuid) is
  'Liefert Bronze/Silber/Gold-Counts der freigeschalteten Achievements für einen User.';
