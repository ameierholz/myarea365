-- Land (ISO-2-Code) auf public.users.
-- Nutzung:
--   - Flagge neben Runner-Namen auf Leaderboards (Wächter, Arena, MMR)
--   - Geo-Filter auf globalen Ranglisten
-- Beim Signup setzt der Client den Wert aus der Browser-Locale bzw. Heimat-PLZ.
-- Backfill: alle bestehenden User bekommen 'DE' (primärer Markt).

alter table public.users
  add column if not exists country text not null default 'DE'
    check (country ~ '^[A-Z]{2}$');

comment on column public.users.country is
  'ISO-3166-1 Alpha-2 Country-Code (z.B. DE, AT, CH). Öffentlich sichtbar für Leaderboards.';

create index if not exists idx_users_country on public.users(country);
