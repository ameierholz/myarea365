-- ════════════════════════════════════════════════════════════════════
-- HEIMAT-CHAT — Multi-Tab Realtime-Chat
-- ════════════════════════════════════════════════════════════════════
-- Tabs:
--   - Heimat (PLZ / Bezirk / Stadt)
--   - Crew (eigene)
--   - DM (Direct Messages + Custom-Gruppen)
--   - CvC (nur während aktiver Saga-Round)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) chat_rooms ───────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'heimat_plz','heimat_bezirk','heimat_stadt',
    'crew','pm','group','cvc'
  )),
  name text,
  -- Geographic-Discriminators (genau einer pro geo-room)
  plz text, bezirk text, city text,
  -- Reference-Discriminators
  crew_id uuid references public.crews(id) on delete cascade,
  bracket_id uuid references public.saga_brackets(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  avatar_url text,
  is_archived boolean not null default false,
  last_message_at timestamptz,
  message_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_chat_rooms_plz on public.chat_rooms(plz) where kind='heimat_plz';
create unique index if not exists ux_chat_rooms_bezirk on public.chat_rooms(bezirk) where kind='heimat_bezirk';
create unique index if not exists ux_chat_rooms_stadt on public.chat_rooms(city) where kind='heimat_stadt';
create unique index if not exists ux_chat_rooms_crew on public.chat_rooms(crew_id) where kind='crew';
create unique index if not exists ux_chat_rooms_cvc on public.chat_rooms(bracket_id) where kind='cvc';
create index if not exists ix_chat_rooms_kind on public.chat_rooms(kind);
create index if not exists ix_chat_rooms_lastmsg on public.chat_rooms(last_message_at desc);
alter table public.chat_rooms enable row level security;

-- ─── 2) chat_room_members ────────────────────────────────────────────
create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  nickname text,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  last_read_message_id uuid,
  muted_until timestamptz,
  primary key (room_id, user_id)
);
create index if not exists ix_chat_members_user on public.chat_room_members(user_id);
alter table public.chat_room_members enable row level security;

-- ─── 3) chat_messages ────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','pin','system','image','voice')),
  body text,
  attachments jsonb,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_chat_msg_room_created on public.chat_messages(room_id, created_at desc);
create index if not exists ix_chat_msg_user on public.chat_messages(user_id);
alter table public.chat_messages enable row level security;

-- ─── 4) chat_reactions ───────────────────────────────────────────────
create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists ix_chat_reactions_msg on public.chat_reactions(message_id);
alter table public.chat_reactions enable row level security;

-- ─── 5) chat_mentions (für @user-Benachrichtigungen) ─────────────────
create table if not exists public.chat_mentions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);
create index if not exists ix_chat_mentions_user_unread on public.chat_mentions(mentioned_user_id) where read_at is null;
alter table public.chat_mentions enable row level security;

-- ─── 6) chat_typing (kurzlebig, nicht permanent) ─────────────────────
create table if not exists public.chat_typing (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.chat_typing enable row level security;

-- ════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════════

-- Helper: ist user in room?
create or replace function public._chat_is_member(p_room uuid, p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (select 1 from public.chat_room_members where room_id = p_room and user_id = p_user);
$$;

do $$ begin
  -- chat_rooms: alle authenticated dürfen Rooms sehen, aber nur die wo sie Mitglied sind
  if not exists (select 1 from pg_policies where tablename='chat_rooms' and policyname='cr_read_member') then
    create policy cr_read_member on public.chat_rooms for select using (public._chat_is_member(id, auth.uid()));
  end if;

  -- chat_room_members: members sehen alle Rows ihrer Rooms
  if not exists (select 1 from pg_policies where tablename='chat_room_members' and policyname='crm_read_room') then
    create policy crm_read_room on public.chat_room_members for select using (
      user_id = auth.uid() or public._chat_is_member(room_id, auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_room_members' and policyname='crm_update_own') then
    create policy crm_update_own on public.chat_room_members for update using (user_id = auth.uid());
  end if;

  -- chat_messages: nur in eigenen Rooms lesen, nur eigene editieren
  if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='cm_read_room') then
    create policy cm_read_room on public.chat_messages for select using (public._chat_is_member(room_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='cm_insert_room') then
    create policy cm_insert_room on public.chat_messages for insert with check (
      user_id = auth.uid() and public._chat_is_member(room_id, auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='cm_update_own') then
    create policy cm_update_own on public.chat_messages for update using (user_id = auth.uid());
  end if;

  -- chat_reactions: lesen/schreiben wenn in room
  if not exists (select 1 from pg_policies where tablename='chat_reactions' and policyname='crx_read') then
    create policy crx_read on public.chat_reactions for select using (
      exists (select 1 from public.chat_messages cm where cm.id = chat_reactions.message_id and public._chat_is_member(cm.room_id, auth.uid()))
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_reactions' and policyname='crx_insert') then
    create policy crx_insert on public.chat_reactions for insert with check (
      user_id = auth.uid() and exists (
        select 1 from public.chat_messages cm where cm.id = chat_reactions.message_id and public._chat_is_member(cm.room_id, auth.uid())
      )
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_reactions' and policyname='crx_delete_own') then
    create policy crx_delete_own on public.chat_reactions for delete using (user_id = auth.uid());
  end if;

  -- chat_mentions: nur eigene
  if not exists (select 1 from pg_policies where tablename='chat_mentions' and policyname='cmt_read_own') then
    create policy cmt_read_own on public.chat_mentions for select using (mentioned_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_mentions' and policyname='cmt_update_own') then
    create policy cmt_update_own on public.chat_mentions for update using (mentioned_user_id = auth.uid());
  end if;

  -- chat_typing: lesen wenn in room, schreiben nur eigenes
  if not exists (select 1 from pg_policies where tablename='chat_typing' and policyname='ct_read') then
    create policy ct_read on public.chat_typing for select using (public._chat_is_member(room_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_typing' and policyname='ct_write_own') then
    create policy ct_write_own on public.chat_typing for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- AUTO-JOIN TRIGGER: Crew-Mitgliedschaft → Crew-Chatroom-Membership
-- ════════════════════════════════════════════════════════════════════
create or replace function public._chat_ensure_crew_room(p_crew_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid; v_name text;
begin
  select id into v_room from public.chat_rooms where kind='crew' and crew_id=p_crew_id;
  if v_room is null then
    select name into v_name from public.crews where id = p_crew_id;
    insert into public.chat_rooms (kind, crew_id, name) values ('crew', p_crew_id, v_name) returning id into v_room;
  end if;
  return v_room;
end $$;

create or replace function public._chat_on_crew_member_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid;
begin
  v_room := public._chat_ensure_crew_room(new.crew_id);
  insert into public.chat_room_members (room_id, user_id, role)
  values (v_room, new.user_id, 'member')
  on conflict do nothing;
  return new;
end $$;

create or replace function public._chat_on_crew_member_delete()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid;
begin
  select id into v_room from public.chat_rooms where kind='crew' and crew_id=old.crew_id;
  if v_room is not null then
    delete from public.chat_room_members where room_id = v_room and user_id = old.user_id;
  end if;
  return old;
end $$;

drop trigger if exists trg_chat_crew_member_ins on public.crew_members;
create trigger trg_chat_crew_member_ins
  after insert on public.crew_members
  for each row execute function public._chat_on_crew_member_insert();

drop trigger if exists trg_chat_crew_member_del on public.crew_members;
create trigger trg_chat_crew_member_del
  after delete on public.crew_members
  for each row execute function public._chat_on_crew_member_delete();

-- ════════════════════════════════════════════════════════════════════
-- BACKFILL: bestehende Crew-Mitgliedschaften → Chat-Rooms
-- ════════════════════════════════════════════════════════════════════
do $$ declare r record;
begin
  for r in select distinct crew_id from public.crew_members loop
    perform public._chat_ensure_crew_room(r.crew_id);
  end loop;
  insert into public.chat_room_members (room_id, user_id, role)
  select cr.id, cm.user_id, 'member'
    from public.crew_members cm
    join public.chat_rooms cr on cr.kind='crew' and cr.crew_id=cm.crew_id
  on conflict do nothing;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- RPCs
-- ════════════════════════════════════════════════════════════════════

-- ─── chat_send_message ───────────────────────────────────────────────
create or replace function public.chat_send_message(
  p_room_id uuid,
  p_body text,
  p_attachments jsonb default null,
  p_reply_to_id uuid default null,
  p_kind text default 'text'
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_msg_id uuid;
  v_mention text;
  v_mentioned_user uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public._chat_is_member(p_room_id, v_user) then raise exception 'not_member'; end if;
  if (p_body is null or length(trim(p_body)) = 0) and (p_attachments is null) then
    raise exception 'empty_message';
  end if;
  if length(coalesce(p_body, '')) > 4000 then raise exception 'message_too_long'; end if;

  insert into public.chat_messages (room_id, user_id, kind, body, attachments, reply_to_id)
  values (p_room_id, v_user, p_kind, p_body, p_attachments, p_reply_to_id)
  returning id into v_msg_id;

  -- @-Mentions extrahieren (Format: @username)
  if p_body ~ '@\w+' then
    for v_mention in select unnest(regexp_matches(p_body, '@(\w+)', 'g')) loop
      select id into v_mentioned_user from public.users
        where lower(username) = lower(v_mention) and id <> v_user
        limit 1;
      if v_mentioned_user is not null then
        -- Nur wenn mentioned User auch im Room ist
        if public._chat_is_member(p_room_id, v_mentioned_user) then
          insert into public.chat_mentions (message_id, mentioned_user_id)
          values (v_msg_id, v_mentioned_user) on conflict do nothing;
        end if;
      end if;
    end loop;
  end if;

  -- Room-Stats
  update public.chat_rooms
     set last_message_at = now(),
         message_count = message_count + 1
   where id = p_room_id;

  -- Typing-Indicator löschen
  delete from public.chat_typing where room_id = p_room_id and user_id = v_user;

  return v_msg_id;
end $$;
revoke all on function public.chat_send_message(uuid, text, jsonb, uuid, text) from public;
grant execute on function public.chat_send_message(uuid, text, jsonb, uuid, text) to authenticated;

-- ─── chat_react ──────────────────────────────────────────────────────
create or replace function public.chat_react(p_message_id uuid, p_emoji text, p_remove boolean default false)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select room_id into v_room from public.chat_messages where id = p_message_id;
  if v_room is null then raise exception 'not_found'; end if;
  if not public._chat_is_member(v_room, v_user) then raise exception 'not_member'; end if;

  if p_remove then
    delete from public.chat_reactions where message_id = p_message_id and user_id = v_user and emoji = p_emoji;
  else
    insert into public.chat_reactions (message_id, user_id, emoji)
    values (p_message_id, v_user, p_emoji)
    on conflict do nothing;
  end if;
end $$;
revoke all on function public.chat_react(uuid, text, boolean) from public;
grant execute on function public.chat_react(uuid, text, boolean) to authenticated;

-- ─── chat_edit_message ───────────────────────────────────────────────
create or replace function public.chat_edit_message(p_message_id uuid, p_new_body text)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select user_id into v_owner from public.chat_messages where id = p_message_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> v_user then raise exception 'not_owner'; end if;
  if length(coalesce(p_new_body, '')) > 4000 then raise exception 'message_too_long'; end if;

  update public.chat_messages
     set body = p_new_body, edited_at = now()
   where id = p_message_id and deleted_at is null;
end $$;
revoke all on function public.chat_edit_message(uuid, text) from public;
grant execute on function public.chat_edit_message(uuid, text) to authenticated;

-- ─── chat_delete_message ─────────────────────────────────────────────
create or replace function public.chat_delete_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select user_id into v_owner from public.chat_messages where id = p_message_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> v_user then raise exception 'not_owner'; end if;

  -- Soft-delete: behält Reply-Anker, body wird leer
  update public.chat_messages
     set deleted_at = now(), body = null, attachments = null
   where id = p_message_id;
end $$;
revoke all on function public.chat_delete_message(uuid) from public;
grant execute on function public.chat_delete_message(uuid) to authenticated;

-- ─── chat_mark_read ──────────────────────────────────────────────────
create or replace function public.chat_mark_read(p_room_id uuid, p_message_id uuid default null)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.chat_room_members
     set last_read_at = now(),
         last_read_message_id = coalesce(p_message_id, last_read_message_id)
   where room_id = p_room_id and user_id = v_user;
end $$;
revoke all on function public.chat_mark_read(uuid, uuid) from public;
grant execute on function public.chat_mark_read(uuid, uuid) to authenticated;

-- ─── chat_typing_ping ────────────────────────────────────────────────
create or replace function public.chat_typing_ping(p_room_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public._chat_is_member(p_room_id, v_user) then raise exception 'not_member'; end if;
  insert into public.chat_typing (room_id, user_id, started_at)
  values (p_room_id, v_user, now())
  on conflict (room_id, user_id) do update set started_at = excluded.started_at;
end $$;
revoke all on function public.chat_typing_ping(uuid) from public;
grant execute on function public.chat_typing_ping(uuid) to authenticated;

-- ─── chat_create_pm ──────────────────────────────────────────────────
-- Findet existierenden 1:1-PM-Room oder legt neuen an.
create or replace function public.chat_create_pm(p_other_user uuid)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_user = p_other_user then raise exception 'cannot_pm_self'; end if;

  -- Existierender PM-Room mit genau diesen 2 Members?
  select cr.id into v_room
    from public.chat_rooms cr
    where cr.kind = 'pm'
      and (select count(*) from public.chat_room_members where room_id = cr.id) = 2
      and exists (select 1 from public.chat_room_members where room_id = cr.id and user_id = v_user)
      and exists (select 1 from public.chat_room_members where room_id = cr.id and user_id = p_other_user)
    limit 1;
  if v_room is not null then return v_room; end if;

  -- Neu anlegen
  insert into public.chat_rooms (kind, created_by) values ('pm', v_user) returning id into v_room;
  insert into public.chat_room_members (room_id, user_id, role) values (v_room, v_user, 'owner'), (v_room, p_other_user, 'member');
  return v_room;
end $$;
revoke all on function public.chat_create_pm(uuid) from public;
grant execute on function public.chat_create_pm(uuid) to authenticated;

-- ─── chat_create_group ───────────────────────────────────────────────
create or replace function public.chat_create_group(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid; v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if length(coalesce(p_name, '')) < 2 then raise exception 'name_too_short'; end if;
  if array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) < 1 then
    raise exception 'no_members';
  end if;

  insert into public.chat_rooms (kind, name, created_by) values ('group', p_name, v_user) returning id into v_room;
  insert into public.chat_room_members (room_id, user_id, role) values (v_room, v_user, 'owner');
  foreach v_id in array p_member_ids loop
    if v_id <> v_user then
      insert into public.chat_room_members (room_id, user_id, role) values (v_room, v_id, 'member')
      on conflict do nothing;
    end if;
  end loop;
  return v_room;
end $$;
revoke all on function public.chat_create_group(text, uuid[]) from public;
grant execute on function public.chat_create_group(text, uuid[]) to authenticated;

-- ─── chat_join_geo_rooms ─────────────────────────────────────────────
-- User wechselt in PLZ/Bezirk/Stadt-Rooms — ggf. neue Rooms anlegen,
-- alte Geo-Memberships entfernen wenn umgezogen.
create or replace function public.chat_join_geo_rooms(p_plz text, p_bezirk text, p_city text)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_plz_room uuid; v_bezirk_room uuid; v_stadt_room uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  -- Alte Geo-Memberships entfernen (nicht mehr passende)
  delete from public.chat_room_members crm
   using public.chat_rooms cr
   where crm.room_id = cr.id and crm.user_id = v_user
     and cr.kind in ('heimat_plz','heimat_bezirk','heimat_stadt')
     and (
       (cr.kind='heimat_plz' and (p_plz is null or cr.plz <> p_plz))
    or (cr.kind='heimat_bezirk' and (p_bezirk is null or cr.bezirk <> p_bezirk))
    or (cr.kind='heimat_stadt' and (p_city is null or cr.city <> p_city))
     );

  -- PLZ-Room
  if p_plz is not null and length(p_plz) > 0 then
    select id into v_plz_room from public.chat_rooms where kind='heimat_plz' and plz=p_plz;
    if v_plz_room is null then
      insert into public.chat_rooms (kind, plz, name) values ('heimat_plz', p_plz, p_plz) returning id into v_plz_room;
    end if;
    insert into public.chat_room_members (room_id, user_id, role) values (v_plz_room, v_user, 'member')
    on conflict do nothing;
  end if;

  -- Bezirk-Room
  if p_bezirk is not null and length(p_bezirk) > 0 then
    select id into v_bezirk_room from public.chat_rooms where kind='heimat_bezirk' and bezirk=p_bezirk;
    if v_bezirk_room is null then
      insert into public.chat_rooms (kind, bezirk, name) values ('heimat_bezirk', p_bezirk, p_bezirk) returning id into v_bezirk_room;
    end if;
    insert into public.chat_room_members (room_id, user_id, role) values (v_bezirk_room, v_user, 'member')
    on conflict do nothing;
  end if;

  -- Stadt-Room
  if p_city is not null and length(p_city) > 0 then
    select id into v_stadt_room from public.chat_rooms where kind='heimat_stadt' and city=p_city;
    if v_stadt_room is null then
      insert into public.chat_rooms (kind, city, name) values ('heimat_stadt', p_city, p_city) returning id into v_stadt_room;
    end if;
    insert into public.chat_room_members (room_id, user_id, role) values (v_stadt_room, v_user, 'member')
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'plz_room', v_plz_room,
    'bezirk_room', v_bezirk_room,
    'stadt_room', v_stadt_room
  );
end $$;
revoke all on function public.chat_join_geo_rooms(text, text, text) from public;
grant execute on function public.chat_join_geo_rooms(text, text, text) to authenticated;

-- ─── chat_join_cvc_room ──────────────────────────────────────────────
-- Wenn User in einem aktiven Bracket ist → Auto-Join CvC-Room.
create or replace function public.chat_join_cvc_room()
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_bracket uuid; v_room uuid; v_name text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  -- Aktives Bracket über Crew-Mitgliedschaft + saga_bracket_crews
  select sbc.bracket_id into v_bracket
    from public.crew_members cm
    join public.saga_bracket_crews sbc on sbc.crew_id = cm.crew_id
    join public.saga_brackets sb on sb.id = sbc.bracket_id
    join public.saga_rounds sr on sr.id = sb.round_id
    where cm.user_id = v_user
      and sr.status in ('matchmaking','active')
    order by sr.created_at desc
    limit 1;

  if v_bracket is null then return null; end if;

  select id into v_room from public.chat_rooms where kind='cvc' and bracket_id=v_bracket;
  if v_room is null then
    select 'CvC-' || coalesce(city_slug, 'Bracket') into v_name from public.saga_brackets where id = v_bracket;
    insert into public.chat_rooms (kind, bracket_id, name) values ('cvc', v_bracket, v_name) returning id into v_room;
  end if;
  insert into public.chat_room_members (room_id, user_id, role) values (v_room, v_user, 'member')
  on conflict do nothing;

  return v_room;
end $$;
revoke all on function public.chat_join_cvc_room() from public;
grant execute on function public.chat_join_cvc_room() to authenticated;

-- ─── chat_get_my_rooms ───────────────────────────────────────────────
-- Aggregierter Snapshot für die Tab-Liste
create or replace function public.chat_get_my_rooms()
returns table (
  room_id uuid,
  kind text,
  name text,
  avatar_url text,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_user text,
  unread_count int,
  member_count int,
  has_mention boolean
)
language sql security definer set search_path=public,pg_temp as $$
  with me as (select auth.uid() as uid),
       my_rooms as (
         select crm.room_id, crm.last_read_at
           from public.chat_room_members crm
           where crm.user_id = (select uid from me)
       )
  select
    cr.id, cr.kind, cr.name, cr.avatar_url, cr.last_message_at,
    (select left(coalesce(body, ''), 100) from public.chat_messages
       where room_id = cr.id and deleted_at is null
       order by created_at desc limit 1) as last_message_preview,
    (select coalesce(u.display_name, u.username, '') from public.chat_messages cm
       left join public.users u on u.id = cm.user_id
       where cm.room_id = cr.id and cm.deleted_at is null
       order by cm.created_at desc limit 1) as last_message_user,
    coalesce((
      select count(*)::int from public.chat_messages cm
       where cm.room_id = cr.id
         and cm.deleted_at is null
         and cm.user_id <> (select uid from me)
         and (mr.last_read_at is null or cm.created_at > mr.last_read_at)
    ), 0) as unread_count,
    (select count(*)::int from public.chat_room_members where room_id = cr.id) as member_count,
    exists (
      select 1 from public.chat_mentions cmt
        join public.chat_messages cm on cm.id = cmt.message_id
       where cm.room_id = cr.id
         and cmt.mentioned_user_id = (select uid from me)
         and cmt.read_at is null
    ) as has_mention
  from my_rooms mr
  join public.chat_rooms cr on cr.id = mr.room_id and cr.is_archived = false
  order by cr.last_message_at desc nulls last;
$$;
revoke all on function public.chat_get_my_rooms() from public;
grant execute on function public.chat_get_my_rooms() to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- MODERATION: Nachricht melden + Runner blockieren
-- ════════════════════════════════════════════════════════════════════

-- ─── chat_message_reports ────────────────────────────────────────────
create table if not exists public.chat_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','hate','sexual','violence','self_harm','other')),
  body text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now()
);
create index if not exists ix_cmr_pending on public.chat_message_reports(status, created_at desc);
create index if not exists ix_cmr_reporter on public.chat_message_reports(reporter_user_id);
-- Verhindert Doppel-Reports desselben Users für dieselbe Message
create unique index if not exists ux_cmr_unique on public.chat_message_reports(message_id, reporter_user_id);
alter table public.chat_message_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='chat_message_reports' and policyname='cmrep_read_own') then
    create policy cmrep_read_own on public.chat_message_reports for select using (reporter_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_message_reports' and policyname='cmrep_insert_own') then
    create policy cmrep_insert_own on public.chat_message_reports for insert with check (reporter_user_id = auth.uid());
  end if;
end $$;

-- ─── user_blocks ─────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);
create index if not exists ix_ub_blocker on public.user_blocks(blocker_user_id);
create index if not exists ix_ub_blocked on public.user_blocks(blocked_user_id);
alter table public.user_blocks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_blocks' and policyname='ub_read_own') then
    create policy ub_read_own on public.user_blocks for select using (blocker_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='user_blocks' and policyname='ub_insert_own') then
    create policy ub_insert_own on public.user_blocks for insert with check (blocker_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='user_blocks' and policyname='ub_delete_own') then
    create policy ub_delete_own on public.user_blocks for delete using (blocker_user_id = auth.uid());
  end if;
end $$;

-- Helper: ist user_a gegenseitig oder einseitig geblockt von user_b?
create or replace function public._user_is_blocked_by(p_user uuid, p_by uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (select 1 from public.user_blocks where blocker_user_id = p_by and blocked_user_id = p_user);
$$;

-- ─── chat_report_message ─────────────────────────────────────────────
create or replace function public.chat_report_message(
  p_message_id uuid,
  p_reason text,
  p_body text default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid; v_owner uuid; v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select room_id, user_id into v_room, v_owner from public.chat_messages where id = p_message_id;
  if v_room is null then raise exception 'not_found'; end if;
  if v_owner = v_user then raise exception 'cannot_report_own'; end if;
  if not public._chat_is_member(v_room, v_user) then raise exception 'not_member'; end if;

  insert into public.chat_message_reports (message_id, reporter_user_id, reason, body)
  values (p_message_id, v_user, p_reason, p_body)
  on conflict (message_id, reporter_user_id) do update
    set reason = excluded.reason, body = excluded.body, created_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.chat_report_message(uuid, text, text) from public;
grant execute on function public.chat_report_message(uuid, text, text) to authenticated;

-- ─── chat_block_user / chat_unblock_user ─────────────────────────────
create or replace function public.chat_block_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_user = p_user_id then raise exception 'cannot_block_self'; end if;
  insert into public.user_blocks (blocker_user_id, blocked_user_id, reason)
  values (v_user, p_user_id, p_reason)
  on conflict (blocker_user_id, blocked_user_id) do update set reason = excluded.reason;
end $$;
revoke all on function public.chat_block_user(uuid, text) from public;
grant execute on function public.chat_block_user(uuid, text) to authenticated;

create or replace function public.chat_unblock_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  delete from public.user_blocks where blocker_user_id = v_user and blocked_user_id = p_user_id;
end $$;
revoke all on function public.chat_unblock_user(uuid) from public;
grant execute on function public.chat_unblock_user(uuid) to authenticated;

-- ─── chat_list_blocked ───────────────────────────────────────────────
create or replace function public.chat_list_blocked()
returns table (blocked_user_id uuid, display_name text, username text, blocked_at timestamptz, reason text)
language sql security definer set search_path=public,pg_temp as $$
  select ub.blocked_user_id, u.display_name, u.username, ub.created_at, ub.reason
    from public.user_blocks ub
    join public.users u on u.id = ub.blocked_user_id
   where ub.blocker_user_id = auth.uid()
   order by ub.created_at desc;
$$;
revoke all on function public.chat_list_blocked() from public;
grant execute on function public.chat_list_blocked() to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- ZUSATZ: Pinned-Messages, Polls, Scheduled-Messages, Saved-Self-Room
-- ════════════════════════════════════════════════════════════════════

-- Pinned: einfache Column auf chat_messages
alter table public.chat_messages
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references public.users(id) on delete set null;
create index if not exists ix_cm_pinned on public.chat_messages(room_id, pinned_at desc) where pinned_at is not null;

-- Polls: an chat_messages gehängt
create table if not exists public.chat_polls (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  question text not null,
  options jsonb not null,         -- z.B. ["19 Uhr","20 Uhr","21 Uhr"]
  multi_choice boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.chat_polls enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='chat_polls' and policyname='cp_read') then
    create policy cp_read on public.chat_polls for select using (
      exists (select 1 from public.chat_messages cm where cm.id = chat_polls.message_id and public._chat_is_member(cm.room_id, auth.uid()))
    );
  end if;
end $$;

create table if not exists public.chat_poll_votes (
  poll_message_id uuid not null references public.chat_polls(message_id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  option_index int not null,
  voted_at timestamptz not null default now(),
  primary key (poll_message_id, user_id, option_index)
);
alter table public.chat_poll_votes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='chat_poll_votes' and policyname='cpv_read') then
    create policy cpv_read on public.chat_poll_votes for select using (
      exists (select 1 from public.chat_polls cp join public.chat_messages cm on cm.id = cp.message_id
              where cp.message_id = chat_poll_votes.poll_message_id and public._chat_is_member(cm.room_id, auth.uid()))
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_poll_votes' and policyname='cpv_insert_own') then
    create policy cpv_insert_own on public.chat_poll_votes for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_poll_votes' and policyname='cpv_delete_own') then
    create policy cpv_delete_own on public.chat_poll_votes for delete using (user_id = auth.uid());
  end if;
end $$;

-- Scheduled messages
create table if not exists public.chat_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  body text not null,
  attachments jsonb,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  scheduled_for timestamptz not null,
  dispatched_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_csm_due on public.chat_scheduled_messages(scheduled_for) where dispatched_at is null and cancelled_at is null;
create index if not exists ix_csm_user on public.chat_scheduled_messages(user_id);
alter table public.chat_scheduled_messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='chat_scheduled_messages' and policyname='csm_read_own') then
    create policy csm_read_own on public.chat_scheduled_messages for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_scheduled_messages' and policyname='csm_insert_own') then
    create policy csm_insert_own on public.chat_scheduled_messages for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_scheduled_messages' and policyname='csm_delete_own') then
    create policy csm_delete_own on public.chat_scheduled_messages for delete using (user_id = auth.uid());
  end if;
end $$;

-- ─── Saved-Self-Room: Self-DM für Notizen ───────────────────────────
-- Pro User genau 1 Room mit kind='saved'
alter table public.chat_rooms drop constraint if exists chat_rooms_kind_check;
alter table public.chat_rooms add constraint chat_rooms_kind_check check (kind in (
  'heimat_plz','heimat_bezirk','heimat_stadt',
  'crew','pm','group','cvc','saved'
));
create unique index if not exists ux_chat_rooms_saved on public.chat_rooms(created_by) where kind='saved';

create or replace function public.chat_get_or_create_saved_room()
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_room from public.chat_rooms where kind='saved' and created_by=v_user;
  if v_room is null then
    insert into public.chat_rooms (kind, created_by, name) values ('saved', v_user, 'Notizen') returning id into v_room;
    insert into public.chat_room_members (room_id, user_id, role) values (v_room, v_user, 'owner');
  end if;
  return v_room;
end $$;
revoke all on function public.chat_get_or_create_saved_room() from public;
grant execute on function public.chat_get_or_create_saved_room() to authenticated;

-- ─── chat_pin_message ────────────────────────────────────────────────
create or replace function public.chat_pin_message(p_message_id uuid, p_unpin boolean default false)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_room uuid; v_role text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select room_id into v_room from public.chat_messages where id = p_message_id;
  if v_room is null then raise exception 'not_found'; end if;
  -- Erlaubt: owner/admin oder eigener Crew-Anführer
  select role into v_role from public.chat_room_members where room_id = v_room and user_id = v_user;
  if v_role is null then raise exception 'not_member'; end if;

  update public.chat_messages
     set pinned_at = case when p_unpin then null else now() end,
         pinned_by = case when p_unpin then null else v_user end
   where id = p_message_id;
end $$;
revoke all on function public.chat_pin_message(uuid, boolean) from public;
grant execute on function public.chat_pin_message(uuid, boolean) to authenticated;

-- ─── chat_create_poll ────────────────────────────────────────────────
create or replace function public.chat_create_poll(
  p_room_id uuid,
  p_question text,
  p_options jsonb,
  p_multi_choice boolean default false,
  p_closes_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_msg uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public._chat_is_member(p_room_id, v_user) then raise exception 'not_member'; end if;
  if jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options) > 10 then raise exception 'invalid_options'; end if;

  -- Trägermessage anlegen
  insert into public.chat_messages (room_id, user_id, kind, body)
  values (p_room_id, v_user, 'text', '📊 ' || p_question)
  returning id into v_msg;

  insert into public.chat_polls (message_id, question, options, multi_choice, closes_at)
  values (v_msg, p_question, p_options, p_multi_choice, p_closes_at);

  update public.chat_rooms
     set last_message_at = now(), message_count = message_count + 1
   where id = p_room_id;
  return v_msg;
end $$;
revoke all on function public.chat_create_poll(uuid, text, jsonb, boolean, timestamptz) from public;
grant execute on function public.chat_create_poll(uuid, text, jsonb, boolean, timestamptz) to authenticated;

-- ─── chat_vote_poll ──────────────────────────────────────────────────
create or replace function public.chat_vote_poll(p_message_id uuid, p_option_index int, p_remove boolean default false)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_multi boolean; v_room uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select cp.multi_choice, cm.room_id into v_multi, v_room
    from public.chat_polls cp join public.chat_messages cm on cm.id = cp.message_id
   where cp.message_id = p_message_id;
  if v_room is null then raise exception 'not_found'; end if;
  if not public._chat_is_member(v_room, v_user) then raise exception 'not_member'; end if;

  if p_remove then
    delete from public.chat_poll_votes where poll_message_id = p_message_id and user_id = v_user and option_index = p_option_index;
    return;
  end if;
  if not v_multi then
    delete from public.chat_poll_votes where poll_message_id = p_message_id and user_id = v_user;
  end if;
  insert into public.chat_poll_votes (poll_message_id, user_id, option_index)
  values (p_message_id, v_user, p_option_index)
  on conflict do nothing;
end $$;
revoke all on function public.chat_vote_poll(uuid, int, boolean) from public;
grant execute on function public.chat_vote_poll(uuid, int, boolean) to authenticated;

-- ─── chat_schedule_message ───────────────────────────────────────────
create or replace function public.chat_schedule_message(
  p_room_id uuid, p_body text, p_scheduled_for timestamptz,
  p_attachments jsonb default null, p_reply_to_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public._chat_is_member(p_room_id, v_user) then raise exception 'not_member'; end if;
  if p_scheduled_for <= now() then raise exception 'must_be_future'; end if;
  if p_scheduled_for > now() + interval '30 days' then raise exception 'too_far_future'; end if;

  insert into public.chat_scheduled_messages (user_id, room_id, body, attachments, reply_to_id, scheduled_for)
  values (v_user, p_room_id, p_body, p_attachments, p_reply_to_id, p_scheduled_for)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.chat_schedule_message(uuid, text, timestamptz, jsonb, uuid) from public;
grant execute on function public.chat_schedule_message(uuid, text, timestamptz, jsonb, uuid) to authenticated;

-- ─── chat_dispatch_due (Cron) ────────────────────────────────────────
create or replace function public.chat_dispatch_due()
returns int
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; v_count int := 0;
begin
  for r in
    select id, user_id, room_id, body, attachments, reply_to_id
      from public.chat_scheduled_messages
     where dispatched_at is null and cancelled_at is null and scheduled_for <= now()
     order by scheduled_for asc
     limit 200
  loop
    -- Member-Check (User könnte zwischenzeitlich rausgeflogen sein)
    if exists (select 1 from public.chat_room_members where room_id = r.room_id and user_id = r.user_id) then
      insert into public.chat_messages (room_id, user_id, kind, body, attachments, reply_to_id)
      values (r.room_id, r.user_id, 'text', r.body, r.attachments, r.reply_to_id);
      update public.chat_rooms set last_message_at = now(), message_count = message_count + 1 where id = r.room_id;
      v_count := v_count + 1;
    end if;
    update public.chat_scheduled_messages set dispatched_at = now() where id = r.id;
  end loop;
  return v_count;
end $$;
revoke all on function public.chat_dispatch_due() from public;
-- Nur service_role darf ausführen (Vercel-Cron via service-role-key)

-- ════════════════════════════════════════════════════════════════════
-- REALTIME PUBLICATION
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- chat_messages, chat_reactions, chat_typing zur Publication hinzufügen
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_reactions') then
      alter publication supabase_realtime add table public.chat_reactions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_typing') then
      alter publication supabase_realtime add table public.chat_typing;
    end if;
  end if;
end $$;
