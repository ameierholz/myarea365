-- ════════════════════════════════════════════════════════════════════
-- 00263 — DM-State (Archive/Mute/Hide), Room-Reports, Rally-Helper, Achievement-Posts
-- ════════════════════════════════════════════════════════════════════

-- ─── DM-State auf Member-Level ───────────────────────────────────────
alter table public.chat_room_members
  add column if not exists archived_at timestamptz,
  add column if not exists muted_at    timestamptz,
  add column if not exists hidden_at   timestamptz;

create index if not exists ix_crm_archived on public.chat_room_members(user_id, archived_at) where archived_at is not null;
create index if not exists ix_crm_hidden   on public.chat_room_members(user_id, hidden_at)   where hidden_at   is not null;

-- ─── Room-Reports (User meldet kompletten DM/Room) ───────────────────
create table if not exists public.chat_room_reports (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason      text not null,
  body        text,
  created_at  timestamptz not null default now()
);
create index if not exists ix_crr_room on public.chat_room_reports(room_id);
alter table public.chat_room_reports enable row level security;

drop policy if exists "crr_insert_own" on public.chat_room_reports;
create policy "crr_insert_own" on public.chat_room_reports
  for insert with check (reporter_id = auth.uid());
drop policy if exists "crr_select_own" on public.chat_room_reports;
create policy "crr_select_own" on public.chat_room_reports
  for select using (reporter_id = auth.uid());

-- ─── chat_set_room_state — Archive/Mute/Hide-Toggle ──────────────────
create or replace function public.chat_set_room_state(
  p_room_id  uuid,
  p_archive  boolean default null,
  p_mute     boolean default null,
  p_hide     boolean default null
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.chat_room_members
     set archived_at = case when p_archive is null then archived_at
                            when p_archive then coalesce(archived_at, now())
                            else null end,
         muted_at    = case when p_mute is null then muted_at
                            when p_mute then coalesce(muted_at, now())
                            else null end,
         hidden_at   = case when p_hide is null then hidden_at
                            when p_hide then coalesce(hidden_at, now())
                            else null end
   where room_id = p_room_id and user_id = v_user;
end$$;
revoke all on function public.chat_set_room_state(uuid, boolean, boolean, boolean) from public;
grant execute on function public.chat_set_room_state(uuid, boolean, boolean, boolean) to authenticated;

-- ─── chat_report_room — User meldet DM-Partner ───────────────────────
create or replace function public.chat_report_room(p_room_id uuid, p_reason text, p_body text default null)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.chat_room_members where room_id=p_room_id and user_id=v_user) then
    raise exception 'not_member';
  end if;
  insert into public.chat_room_reports (room_id, reporter_id, reason, body)
       values (p_room_id, v_user, p_reason, p_body)
    returning id into v_id;
  return v_id;
end$$;
revoke all on function public.chat_report_room(uuid, text, text) from public;
grant execute on function public.chat_report_room(uuid, text, text) to authenticated;

-- ─── chat_get_my_rooms erweitern (archived/muted, hidden filter) ─────
drop function if exists public.chat_get_my_rooms();
create or replace function public.chat_get_my_rooms()
returns table (
  room_id uuid, kind text, name text, avatar_url text,
  last_message_at timestamptz, last_message_preview text, last_message_user text,
  unread_count int, member_count int, has_mention boolean,
  archived boolean, muted boolean
) language sql security definer set search_path=public,pg_temp as $$
  with me as (select auth.uid() as uid),
       my_rooms as (
         select crm.room_id, crm.last_read_at, crm.archived_at, crm.muted_at
           from public.chat_room_members crm
           where crm.user_id = (select uid from me)
             and crm.hidden_at is null
       )
  select
    cr.id, cr.kind, cr.name, cr.avatar_url, cr.last_message_at,
    (select left(coalesce(body, ''), 100) from public.chat_messages
       where room_id = cr.id and deleted_at is null
       order by created_at desc limit 1),
    (select coalesce(u.display_name, u.username, '') from public.chat_messages cm
       left join public.users u on u.id = cm.user_id
       where cm.room_id = cr.id and cm.deleted_at is null
       order by cm.created_at desc limit 1),
    coalesce((
      select count(*)::int from public.chat_messages cm
       where cm.room_id = cr.id
         and cm.deleted_at is null
         and cm.user_id <> (select uid from me)
         and (mr.last_read_at is null or cm.created_at > mr.last_read_at)
    ), 0),
    (select count(*)::int from public.chat_room_members where room_id = cr.id),
    exists (
      select 1 from public.chat_mentions cmt
        join public.chat_messages cm on cm.id = cmt.message_id
       where cm.room_id = cr.id
         and cmt.mentioned_user_id = (select uid from me)
         and cmt.read_at is null
    ),
    (mr.archived_at is not null),
    (mr.muted_at is not null)
  from my_rooms mr
  join public.chat_rooms cr on cr.id = mr.room_id and cr.is_archived = false
  order by cr.last_message_at desc nulls last;
$$;
revoke all on function public.chat_get_my_rooms() from public;
grant execute on function public.chat_get_my_rooms() to authenticated;

-- ─── Achievement-Auto-Post in Crew-Room ──────────────────────────────
create or replace function public.trg_chat_achievement_post()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_crew uuid;
  v_room uuid;
  v_uname text;
  v_aname text;
begin
  select crew_id into v_crew from public.crew_members where user_id = new.user_id limit 1;
  if v_crew is null then return new; end if;

  select id into v_room from public.chat_rooms where kind='crew' and crew_id=v_crew limit 1;
  if v_room is null then return new; end if;

  select coalesce(display_name, username, 'Runner') into v_uname from public.users where id = new.user_id;
  select coalesce(name, slug) into v_aname from public.achievements where id = new.achievement_id;

  insert into public.chat_messages (room_id, user_id, kind, body)
  values (v_room, null, 'system',
    '🏆 ' || v_uname || ' hat das Achievement "' || coalesce(v_aname, 'Unbekannt') || '" freigeschaltet!');

  return new;
exception when others then
  return new;
end$$;

drop trigger if exists trg_user_achievements_chat_post on public.user_achievements;
create trigger trg_user_achievements_chat_post
  after insert on public.user_achievements
  for each row execute function public.trg_chat_achievement_post();
