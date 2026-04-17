-- App-Präferenzen: Privatsphäre, E-Mail, Tracking, Ads, Beta
-- Spiegelt die Frontend-Prefs aus apps/web/src/lib/prefs.ts

alter table public.users
  add column if not exists privacy_leaderboard boolean default true,
  add column if not exists privacy_live_crew boolean default true,
  add column if not exists privacy_territories boolean default true,
  add column if not exists privacy_routes boolean default false,
  add column if not exists privacy_searchable boolean default true,
  add column if not exists privacy_crew_invites boolean default true,
  add column if not exists privacy_friends boolean default true,
  add column if not exists email_notif_weekly boolean default false,
  add column if not exists email_notif_monthly boolean default true,
  add column if not exists email_notif_newsletter boolean default false,
  add column if not exists email_notif_flash_deals boolean default false,
  add column if not exists track_gps text default 'high' check (track_gps in ('high','balanced','low')),
  add column if not exists track_snap boolean default true,
  add column if not exists track_autostart boolean default false,
  add column if not exists track_wakelock boolean default true,
  add column if not exists track_pace_announce boolean default false,
  add column if not exists track_voice text default 'female' check (track_voice in ('female','male','neutral')),
  add column if not exists track_pace_interval text default '1',
  add column if not exists ads_personalized boolean default true,
  add column if not exists ads_anon_stats boolean default true,
  add column if not exists app_beta boolean default false,
  add column if not exists notif_crew_chat boolean default true,
  add column if not exists notif_crew_events boolean default true,
  add column if not exists notif_duels boolean default true,
  add column if not exists notif_achievements boolean default true,
  add column if not exists notif_rank_up boolean default true,
  add column if not exists notif_shop_deals boolean default true,
  add column if not exists notif_streak_warn boolean default true,
  add column if not exists notif_quiet_start smallint default 22 check (notif_quiet_start between 0 and 23),
  add column if not exists notif_quiet_end smallint default 7 check (notif_quiet_end between 0 and 23);

-- send-monthly-stats respektiert künftig email_notif_monthly statt email_notif_runs.
-- Alte Spalte als Alias beibehalten, aber Prio auf neue Spalte legen.
create or replace view public.v_monthly_mail_recipients as
  select id, display_name, username
    from public.users
   where coalesce(email_notif_monthly, email_notif_runs, true) = true;

-- RLS: Privacy-Searchable beeinflusst Sichtbarkeit bei Username-Suche.
-- (Policy-Implementierung erfolgt in separater Migration sobald Suche live ist.)
