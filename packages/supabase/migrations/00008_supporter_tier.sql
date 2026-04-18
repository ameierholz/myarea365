-- Supporter-Tier (ABO über Bronze/Silber/Gold-Badges)
alter table public.users
  add column if not exists supporter_tier text check (supporter_tier in ('bronze','silver','gold')),
  add column if not exists supporter_since timestamptz;
