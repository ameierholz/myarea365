-- 00059: Shop-Settings — Öffnungszeiten, Team-Zugang, Notification-Prefs,
--        Cover-Bild, Pause-Flag.
--
-- Bisher konnten Shop-Owner im Settings-Tab nichts wirklich speichern
-- (alles Stubs). Diese Migration liefert das Schema für die echten
-- Einstellungen + neue Self-Service-Features.

-- ═══════════════════════════════════════════════════════
-- 1) Zusatz-Spalten auf local_businesses
-- ═══════════════════════════════════════════════════════
alter table public.local_businesses
  add column if not exists opening_hours jsonb,
  add column if not exists cover_url text,
  add column if not exists paused_at timestamptz;

comment on column public.local_businesses.opening_hours is
  'JSONB-Array: [{"day":"mon","open":"08:00","close":"18:00","closed":false}, ...]. 7 Einträge für Mo–So.';
comment on column public.local_businesses.cover_url is
  'Optionales Banner-Bild (1200×400 empfohlen) — sichtbar auf der Shop-Detail-Seite.';
comment on column public.local_businesses.paused_at is
  'Wenn gesetzt, ist der Shop vom Owner pausiert (nicht sichtbar für Runner). NULL = aktiv.';

-- ═══════════════════════════════════════════════════════
-- 2) Notification-Prefs pro Shop
-- ═══════════════════════════════════════════════════════
create table if not exists public.shop_notification_prefs (
  shop_id uuid primary key references public.local_businesses(id) on delete cascade,
  email_on_checkin boolean not null default false,
  email_daily_report boolean not null default true,
  email_weekly_summary boolean not null default true,
  kiez_newsletter boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.shop_notification_prefs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_notification_prefs' and policyname='snp_owner_all') then
    create policy snp_owner_all on public.shop_notification_prefs
      for all using (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      ) with check (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 3) Team-Zugang: mehrere Mitarbeiter pro Shop
-- ═══════════════════════════════════════════════════════
create table if not exists public.shop_team_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.local_businesses(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  role text not null default 'manager' check (role in ('manager','staff')),
  invited_by uuid references public.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (shop_id, email)
);

create index if not exists idx_shop_team_shop on public.shop_team_members(shop_id);
create index if not exists idx_shop_team_user on public.shop_team_members(user_id) where user_id is not null;

alter table public.shop_team_members enable row level security;

do $$ begin
  -- Owner liest + verwaltet alle Team-Mitglieder seines Shops
  if not exists (select 1 from pg_policies where tablename='shop_team_members' and policyname='stm_owner_manage') then
    create policy stm_owner_manage on public.shop_team_members
      for all using (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      ) with check (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
  -- Team-Mitglied selbst sieht seine Rolle
  if not exists (select 1 from pg_policies where tablename='shop_team_members' and policyname='stm_self_read') then
    create policy stm_self_read on public.shop_team_members
      for select using (user_id = auth.uid());
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 4) Beim User-Signup: vorhandene Einladung mit user_id verknüpfen
-- ═══════════════════════════════════════════════════════
create or replace function public.link_pending_team_invites()
returns trigger language plpgsql security definer as $$
begin
  update public.shop_team_members
    set user_id = new.id, accepted_at = coalesce(accepted_at, now())
    where email = new.email and user_id is null;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_link_pending_team_invites') then
    create trigger trg_link_pending_team_invites
      after insert on public.users
      for each row execute function public.link_pending_team_invites();
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 5) Shop-Löschung via RPC (Owner-only, mit Cascade-Check)
-- ═══════════════════════════════════════════════════════
create or replace function public.delete_my_shop(p_shop_id uuid, p_confirm text)
returns jsonb language plpgsql security definer as $$
begin
  if p_confirm <> 'LÖSCHEN' then
    return jsonb_build_object('ok', false, 'error', 'wrong_confirm');
  end if;
  if not exists (
    select 1 from public.local_businesses
    where id = p_shop_id and owner_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  delete from public.local_businesses where id = p_shop_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.delete_my_shop(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 6) Index für Pause-Filter beim Public-Read
-- ═══════════════════════════════════════════════════════
create index if not exists idx_lb_active_not_paused
  on public.local_businesses(status, active)
  where status = 'approved' and active = true and paused_at is null;
