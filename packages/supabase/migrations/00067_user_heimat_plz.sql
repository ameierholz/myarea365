-- Heimat-PLZ des Runners (optional, 5-stellig deutsch).
-- Nutzung:
--   - Badge neben Runner-Namen auf Map / Leaderboard
--   - Optional für lokale Features (Kiez-Newsletter-Filter)
-- Die Kiez-Krone basiert NICHT auf heimat_plz, sondern auf km-Aktivität
-- pro PLZ in der letzten Woche (wird separat berechnet).

alter table public.users
  add column if not exists heimat_plz text
    check (heimat_plz is null or heimat_plz ~ '^[0-9]{5}$');

comment on column public.users.heimat_plz is
  'Optionale Heimat-Postleitzahl (5-stellig, DE). Badge-Funktion, öffentlich sichtbar.';

create index if not exists idx_users_heimat_plz on public.users(heimat_plz)
  where heimat_plz is not null;
