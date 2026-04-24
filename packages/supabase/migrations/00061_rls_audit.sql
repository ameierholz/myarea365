-- 00061_rls_audit.sql
-- Stellt sicher, dass auf ALLEN anwendungsrelevanten Tabellen RLS aktiviert ist.
-- FORCE RLS gilt auch für Table-Owner, damit niemand versehentlich ohne Policy liest.
--
-- Wenn du neue Tabellen hinzufügst, trage sie hier ein.

do $$
declare
  tbl text;
  tbls text[] := array[
    -- Core
    'users','groups','group_members','areas','area_claims','walks',
    'achievements','user_achievements','local_businesses','qr_codes',
    'xp_transactions','map_icons',
    -- Gameplay
    'territories','missions','seasons','feature_flags','audit_log',
    -- Social
    'crews','crew_members','crew_invites','friendships','user_guardians',
    -- Shop B2B
    'shop_deals','shop_redemptions','shop_subscriptions','shop_purchases',
    'shop_reports','shop_notification_prefs','shop_team_members',
    'crew_shop_stamps','shop_crew_rewards',
    -- Email / Marketing
    'newsletter_subscribers','broadcasts','support_tickets',
    -- Admin
    'admin_users','impersonation_log'
  ];
begin
  foreach tbl in array tbls loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = tbl) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('alter table public.%I force row level security', tbl);
    end if;
  end loop;
end$$;

-- Helper-View zum manuellen Audit: Tabellen ohne RLS oder ohne Policies anzeigen.
create or replace view public._rls_audit as
select
  t.tablename,
  t.rowsecurity   as rls_enabled,
  coalesce(p.policy_count, 0) as policy_count
from pg_tables t
left join (
  select schemaname, tablename, count(*)::int as policy_count
  from pg_policies
  group by 1, 2
) p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
order by t.tablename;

comment on view public._rls_audit is 'Admin-Audit: zeigt pro Tabelle ob RLS aktiv ist und wie viele Policies existieren. Zeilen mit rls_enabled=false oder policy_count=0 sind potenziell unsicher.';
