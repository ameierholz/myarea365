-- ─── 00205: Security-Hardening (Pre-Launch-Sweep) ──────────────────
-- 1) Alle SECURITY DEFINER Views auf security_invoker umstellen → RLS greift wieder
-- 2) Public-Storage-Buckets: LIST-Policies entfernen (URL-Zugriff bleibt)
-- 3) Alle 293 SECURITY DEFINER functions explizit search_path = public, pg_temp
-- 4) RLS auf mapbox_route_cache aktiv (service_role-only Zugriff)

-- ── 1) SECURITY DEFINER Views → security_invoker ───────────────────
do $$
declare v text;
begin
  for v in
    select schemaname || '.' || viewname
      from pg_views
     where schemaname='public'
       and viewname in (
         'my_guardian_collection','weekly_plz_km','user_prestige_total','current_plz_kings',
         'v_monthly_mail_recipients','v_ansehen_leaderboard','shop_reviews_agg','_rls_audit',
         'boss_raid_crew_damage','crew_block_control','v_public_profiles','user_crown_plzs',
         'player_base_scouts_v','resource_node_active_gathers'
       )
  loop
    execute format('alter view %s set (security_invoker = true)', v);
  end loop;
end $$;

-- ── 2) Public-Bucket-LIST blockieren ──────────────────────────────
-- Public-Bucket-URLs (getPublicUrl) gehen NICHT durch storage.objects RLS
-- → URL-Zugriff bleibt funktionsfähig. Aber storage.from('artwork').list()
-- wird unmöglich → niemand kann Admin-/Draft-Artwork enumerieren.
drop policy if exists "artwork public read" on storage.objects;
drop policy if exists "artwork_public_read" on storage.objects;
drop policy if exists "shop_media_public_read" on storage.objects;

-- ── 3) Bulk-Fix: search_path für alle public Functions ─────────────
-- War vorher implizit — wir setzen es explizit, damit Schema-Hijacking via
-- session-config nicht möglich ist. WICHTIG: PostGIS liegt im `extensions`-
-- Schema, daher muss `extensions` mit drin sein, sonst verlieren PostGIS-
-- nutzende Functions ihren `geometry`-Type-Lookup (Bug erst beim Test gefangen).
do $$
declare r record; cnt int := 0;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.prokind='f'
       and (p.proconfig is null or not exists (
            select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'))
  loop
    execute format('alter function %I.%I(%s) set search_path = public, extensions, pg_temp;',
                   r.nspname, r.proname, r.args);
    cnt := cnt + 1;
  end loop;
  raise notice 'Patched % functions with explicit search_path', cnt;
end $$;

-- ── 4) mapbox_route_cache RLS (siehe 00204, hier nur idempotent) ──
alter table public.mapbox_route_cache enable row level security;
