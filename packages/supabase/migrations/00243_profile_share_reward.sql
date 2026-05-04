-- 00243: Profile-Share-Reward (one-time +50 Wegemünzen)
--
-- Der Währungs-Guide verspricht "Profil geteilt (einmalig) +50 🪙" — bisher
-- ohne Server-Counterpart. Dieser One-Time-Flag verhindert Multi-Claim.

alter table public.users
  add column if not exists profile_shared_at timestamptz;

comment on column public.users.profile_shared_at is
  'Zeitpunkt des ersten Profil-Share. Sperrt weitere +50-Belohnungen. NULL = noch nie geteilt.';
