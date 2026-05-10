-- 00292_push_notifications.sql
-- Web-Push-Subscriptions + Notification-Preferences als persistente Quelle der
-- Wahrheit (statt nur localStorage). Sobald VAPID-Keys gesetzt sind, kann der
-- Server gezielt pushen — bis dahin bleibt der Speicher die Grundlage für
-- Trigger-RPCs (siehe send_push_to_user).
--
-- WICHTIG: Push-Versand erfolgt aus Next-API-Routen mit web-push-Lib + VAPID
-- (env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT). Diese Migration
-- erzeugt nur Schemas + Helper-RPCs.

-- 1) Notification-Preferences pro User
create table if not exists public.user_notification_prefs (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  push_enabled      boolean not null default true,
  crew_chat         boolean not null default true,
  crew_events       boolean not null default true,
  duels             boolean not null default true,
  achievements      boolean not null default true,
  rank_up           boolean not null default true,
  shop_deals        boolean not null default true,
  streak_warn       boolean not null default true,
  quiet_mode        boolean not null default true,
  quiet_start_hour  smallint not null default 22 check (quiet_start_hour between 0 and 23),
  quiet_end_hour    smallint not null default 7  check (quiet_end_hour   between 0 and 23),
  email_weekly      boolean not null default false,
  email_monthly     boolean not null default true,
  email_newsletter  boolean not null default false,
  email_flash_deals boolean not null default false,
  updated_at        timestamptz not null default now()
);

alter table public.user_notification_prefs enable row level security;

drop policy if exists "own_prefs_select" on public.user_notification_prefs;
create policy "own_prefs_select" on public.user_notification_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "own_prefs_upsert" on public.user_notification_prefs;
create policy "own_prefs_upsert" on public.user_notification_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_prefs_update" on public.user_notification_prefs;
create policy "own_prefs_update" on public.user_notification_prefs
  for update using (auth.uid() = user_id);


-- 2) Push-Subscriptions (1..n pro User — Mehrgeräte-Support)
create table if not exists public.user_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth_secret text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists idx_push_subs_user on public.user_push_subscriptions(user_id);

alter table public.user_push_subscriptions enable row level security;

drop policy if exists "own_subs_select" on public.user_push_subscriptions;
create policy "own_subs_select" on public.user_push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "own_subs_insert" on public.user_push_subscriptions;
create policy "own_subs_insert" on public.user_push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_subs_delete" on public.user_push_subscriptions;
create policy "own_subs_delete" on public.user_push_subscriptions
  for delete using (auth.uid() = user_id);


-- 3) Helper: Aktive Push-Targets für einen User holen, mit Kind-Gating
-- Returns rows (endpoint, p256dh, auth_secret) — bereits gefiltert auf das
-- gewünschte kind (z.B. 'crew_chat') und Quiet-Mode-Fenster.
create or replace function public.get_push_targets_for_user(
  p_user_id uuid,
  p_kind text  -- 'crew_chat' | 'crew_events' | 'duels' | 'achievements' | 'rank_up' | 'shop_deals' | 'streak_warn'
)
returns table(endpoint text, p256dh text, auth_secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs record;
  v_now_hour smallint := extract(hour from now())::smallint;
  v_in_quiet boolean := false;
begin
  select * into v_prefs from public.user_notification_prefs where user_id = p_user_id;
  if not found or not v_prefs.push_enabled then return; end if;

  -- Kind-Toggle prüfen
  if p_kind = 'crew_chat'    and not v_prefs.crew_chat    then return; end if;
  if p_kind = 'crew_events'  and not v_prefs.crew_events  then return; end if;
  if p_kind = 'duels'        and not v_prefs.duels        then return; end if;
  if p_kind = 'achievements' and not v_prefs.achievements then return; end if;
  if p_kind = 'rank_up'      and not v_prefs.rank_up      then return; end if;
  if p_kind = 'shop_deals'   and not v_prefs.shop_deals   then return; end if;
  if p_kind = 'streak_warn'  and not v_prefs.streak_warn  then return; end if;

  -- Quiet-Mode prüfen (außer für duels — die müssen sofort durch)
  if v_prefs.quiet_mode and p_kind <> 'duels' then
    if v_prefs.quiet_start_hour < v_prefs.quiet_end_hour then
      v_in_quiet := v_now_hour >= v_prefs.quiet_start_hour and v_now_hour < v_prefs.quiet_end_hour;
    else
      -- Über Mitternacht (z.B. 22 → 7)
      v_in_quiet := v_now_hour >= v_prefs.quiet_start_hour or v_now_hour < v_prefs.quiet_end_hour;
    end if;
    if v_in_quiet then return; end if;
  end if;

  return query
    select s.endpoint, s.p256dh, s.auth_secret
    from public.user_push_subscriptions s
    where s.user_id = p_user_id;
end;
$$;

grant execute on function public.get_push_targets_for_user(uuid, text) to authenticated, service_role;


-- 4) Helper: Default-Prefs anlegen falls noch keine existieren (idempotent)
create or replace function public.ensure_notification_prefs(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notification_prefs (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_notification_prefs(uuid) to authenticated, service_role;
