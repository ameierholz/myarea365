-- 00311 — Push-Pending-Queue
-- user_inbox bekommt push_attempted_at, damit der /api/cron/send-pending-pushes
-- Endpoint genau einmal pro Eintrag versucht zu pushen.

alter table public.user_inbox
  add column if not exists push_attempted_at timestamptz;

create index if not exists user_inbox_push_pending_idx
  on public.user_inbox (created_at)
  where push_attempted_at is null and deleted_at is null;

-- RPC: liefert die nächsten N inbox-Einträge die einen Push brauchen.
-- Begrenzt auf Einträge der letzten 24h (alles ältere ist Backlog → skip).
create or replace function public.get_pending_push_inbox(p_limit int default 100)
  returns table(
    id uuid,
    user_id uuid,
    title text,
    body text,
    category text,
    kind text,
    payload jsonb,
    created_at timestamptz
  )
  language sql security definer set search_path = public as $$
  select id, user_id, title, body, category, kind, payload, created_at
  from public.user_inbox
  where push_attempted_at is null
    and deleted_at is null
    and created_at > now() - interval '24 hours'
  order by created_at asc
  limit p_limit;
$$;

-- Bulk-Mark-Helper damit der Endpoint nach dem Senden in einem Update den
-- push_attempted_at-Timestamp setzt (auch wenn das Senden fehlschlägt — wir
-- versuchen nicht endlos zu pushen).
create or replace function public.mark_inbox_push_attempted(p_ids uuid[])
  returns int
  language sql security definer set search_path = public as $$
  with up as (
    update public.user_inbox
       set push_attempted_at = now()
     where id = any(p_ids)
       and push_attempted_at is null
     returning 1
  )
  select count(*)::int from up;
$$;

revoke all on function public.get_pending_push_inbox(int) from public;
revoke all on function public.mark_inbox_push_attempted(uuid[]) from public;
grant execute on function public.get_pending_push_inbox(int) to service_role;
grant execute on function public.mark_inbox_push_attempted(uuid[]) to service_role;
