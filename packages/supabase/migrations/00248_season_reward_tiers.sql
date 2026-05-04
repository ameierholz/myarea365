-- 00248: Konfigurierbare Reward-Tiers für die 3 Saison-Systeme
--
-- Bisher waren die Reward-Werte (Top-1 Crew = 5000 🏴, Arena #1 = 500 💎, …)
-- als CASE-Statements in den finalize_*-Funktionen hardcoded. Damit der Admin
-- ohne Migration die Werte ändern kann (z.B. „Mai-Aktion: Rewards verdoppelt")
-- liegen sie jetzt in season_reward_tiers.
--
-- Lookup-Helper season_reward_for_rank(system, rank, eligible) wird von den
-- 3 finalize_-Funktionen aufgerufen (siehe 00249).

create table if not exists public.season_reward_tiers (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('shop_league','arena','turf_war')),
  rank_min int not null,
  rank_max int not null,
  gebietsruf int not null default 0,
  gems int not null default 0,
  siegel_universal int not null default 0,
  participation_only boolean not null default false,
  label text,
  updated_at timestamptz not null default now(),
  unique (system, rank_min)
);

create index if not exists idx_season_reward_tiers_system
  on public.season_reward_tiers(system, rank_min);

alter table public.season_reward_tiers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='season_reward_tiers' and policyname='srt_public_read') then
    create policy srt_public_read on public.season_reward_tiers for select using (true);
  end if;
end $$;

insert into public.season_reward_tiers (system, rank_min, rank_max, gebietsruf, gems, siegel_universal, participation_only, label) values
  ('shop_league', 1,    1,    5000, 0,   0,  false, 'Sieger der Woche'),
  ('shop_league', 2,    2,    2500, 0,   0,  false, 'Vize'),
  ('shop_league', 3,    3,    1000, 0,   0,  false, 'Bronze'),
  ('shop_league', 4,    9999, 250,  0,   0,  true,  'Teilnahme (≥1 Sieg)'),
  ('arena', 1,   1,   0, 500, 50, false, 'Champion'),
  ('arena', 2,   3,   0, 300, 25, false, 'Gladiator'),
  ('arena', 4,   10,  0, 150, 10, false, 'Kriegsmeister'),
  ('arena', 11,  50,  0, 50,  3,  false, 'Veteran'),
  ('arena', 51,  100, 0, 20,  1,  false, 'Top-100'),
  ('turf_war', 1,   1,    10000, 0, 0, false, 'Crew #1'),
  ('turf_war', 2,   3,     5000, 0, 0, false, 'Top-3'),
  ('turf_war', 4,   10,    2500, 0, 0, false, 'Top-10'),
  ('turf_war', 11,  50,    1000, 0, 0, false, 'Top-50'),
  ('turf_war', 51,  9999,  250,  0, 0, true,  'Teilnahme (≥1 War-Sieg)')
on conflict (system, rank_min) do nothing;

create or replace function public.season_reward_for_rank(
  p_system text, p_rank int, p_eligible boolean default true
) returns table (gebietsruf int, gems int, siegel_universal int)
language sql stable as $$
  select t.gebietsruf, t.gems, t.siegel_universal
    from public.season_reward_tiers t
   where t.system = p_system
     and p_rank between t.rank_min and t.rank_max
     and (not t.participation_only or p_eligible)
   order by t.rank_min asc
   limit 1
$$;

grant execute on function public.season_reward_for_rank(text,int,boolean) to authenticated, service_role;
