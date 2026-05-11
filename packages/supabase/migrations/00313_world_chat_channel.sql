-- 00313 — Welt-Chat-Channel
-- Globaler Channel "world": ein einziger Room, alle eingeloggten User sind
-- automatisch Mitglied, RLS folgt dem heimat_*-Pattern.

alter table public.chat_rooms drop constraint if exists chat_rooms_kind_check;
alter table public.chat_rooms add constraint chat_rooms_kind_check check (kind in (
  'heimat_plz','heimat_bezirk','heimat_stadt',
  'crew','pm','group','cvc','saved','world'
));

-- Singleton-Constraint: max 1 Welt-Room.
create unique index if not exists ux_chat_rooms_world on public.chat_rooms(kind) where kind = 'world';

-- Welt-Room anlegen wenn er nicht existiert.
insert into public.chat_rooms (kind, name, avatar_url)
  select 'world', 'Welt-Chat', null
  where not exists (select 1 from public.chat_rooms where kind = 'world');

-- RPC: stellt sicher dass der aufrufende User Member im Welt-Room ist.
create or replace function public.chat_ensure_world_membership()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_room uuid;
begin
  if v_user is null then return null; end if;
  select id into v_room from public.chat_rooms where kind = 'world' limit 1;
  if v_room is null then return null; end if;
  insert into public.chat_room_members (room_id, user_id, role)
    values (v_room, v_user, 'member')
    on conflict (room_id, user_id) do nothing;
  return v_room;
end $$;

grant execute on function public.chat_ensure_world_membership() to authenticated;
