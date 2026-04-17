-- ═══════════════════════════════════════════════════════
-- 00002: Newsletter + E-Mail-Präferenzen + Onboarding-State
-- ═══════════════════════════════════════════════════════

-- 1) User-Felder: Newsletter + Sprache + Onboarding
alter table public.users
  add column if not exists newsletter_opt_in      boolean not null default false,
  add column if not exists welcome_email_sent_at  timestamptz,
  add column if not exists onboarding_completed   boolean not null default false,
  add column if not exists email_locale           text not null default 'de',
  add column if not exists email_notif_runs       boolean not null default true,
  add column if not exists email_notif_crew       boolean not null default true,
  add column if not exists email_notif_challenges boolean not null default true,
  add column if not exists email_notif_streaks    boolean not null default true;

-- 2) Separate Newsletter-Tabelle für E-Mails ohne Account (Marketing-Landing)
create table if not exists public.newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  locale        text not null default 'de',
  source        text,                                  -- 'registration', 'landing', 'footer'
  confirmed_at  timestamptz,                           -- double-opt-in
  confirm_token text,                                  -- Einmal-Link
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_email_idx on public.newsletter_subscribers (email);
create index if not exists newsletter_subscribers_confirmed_idx on public.newsletter_subscribers (confirmed_at) where confirmed_at is not null;

alter table public.newsletter_subscribers enable row level security;

-- 3) E-Mail-Events-Log (für Debug + Bounce-Tracking)
create table if not exists public.email_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete set null,
  email        text not null,
  type         text not null,                          -- 'welcome', 'newsletter', 'verify', 'password_reset', 'reminder'
  provider_id  text,                                   -- Resend message-id
  status       text not null default 'queued',         -- 'queued', 'sent', 'delivered', 'bounced', 'complained'
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists email_events_user_idx on public.email_events (user_id);
create index if not exists email_events_email_idx on public.email_events (email);
create index if not exists email_events_type_idx on public.email_events (type);

alter table public.email_events enable row level security;

-- Policy: Server-only (Service-Role)
create policy "email_events server only"
  on public.email_events for all
  using (false);

-- 4) Trigger: Wenn Nutzer sich selbst mit opt-in registriert → Newsletter-Tabelle füllen
create or replace function public.sync_user_newsletter()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.newsletter_opt_in and (OLD is null or OLD.newsletter_opt_in is distinct from NEW.newsletter_opt_in) then
    insert into public.newsletter_subscribers (email, locale, source, confirmed_at)
    values (
      (select email from auth.users where id = NEW.id),
      NEW.email_locale,
      'registration',
      now()  -- bei bereits verifiziertem Account gilt bestätigt
    )
    on conflict (email) do update
      set locale = excluded.locale,
          unsubscribed_at = null;
  elsif not NEW.newsletter_opt_in and (OLD is not null and OLD.newsletter_opt_in) then
    update public.newsletter_subscribers
       set unsubscribed_at = now()
     where email = (select email from auth.users where id = NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists users_newsletter_sync on public.users;
create trigger users_newsletter_sync
  after insert or update of newsletter_opt_in on public.users
  for each row execute function public.sync_user_newsletter();
