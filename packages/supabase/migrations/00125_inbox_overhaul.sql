-- ════════════════════════════════════════════════════════════════════
-- INBOX OVERHAUL — CoD-Style Mehrkanal-Postfach (Phase 1-4 Schema)
-- ════════════════════════════════════════════════════════════════════
-- Erweitert public.user_inbox um:
--   - category (personal/report/crew/event/system/sent)
--   - subcategory (pvp/pve/misc/decree/announcement/bounty/...)
--   - kind (battle_report/spy_report/rally_report/spy_warning/...)
--   - payload jsonb (strukturierte Daten für Rich-Renderer)
--   - is_starred boolean (Gespeichert-Flag)
--   - deleted_at timestamptz (Soft-Delete)
--   - from_user_id (für persönliche Nachrichten + Crew-Posts)
--   - reward_payload jsonb + claimed_at (für "Einsammeln"-Aktion)
--
-- + RPCs für: send_personal_message, post_crew_message,
--             claim_inbox_rewards, mark_inbox_deleted, toggle_inbox_star,
--             inbox_counts, get_inbox_messages
-- ════════════════════════════════════════════════════════════════════

-- ─── 0) Safety-Net: user_inbox-Tabelle anlegen falls 00032 nie lief ───
create table if not exists public.user_inbox (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  broadcast_id  uuid,
  title         text not null,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_user_inbox_user on public.user_inbox(user_id, read_at, created_at desc);
alter table public.user_inbox enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_inbox' and policyname='user_inbox_own_read') then
    create policy user_inbox_own_read on public.user_inbox for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_inbox' and policyname='user_inbox_own_update') then
    create policy user_inbox_own_update on public.user_inbox for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ─── 1) Spalten ergänzen ──────────────────────────────────────────────
alter table public.user_inbox
  add column if not exists category       text not null default 'system',
  add column if not exists subcategory    text,
  add column if not exists kind           text,
  add column if not exists payload        jsonb,
  add column if not exists is_starred     boolean not null default false,
  add column if not exists deleted_at     timestamptz,
  add column if not exists from_user_id   uuid references public.users(id) on delete set null,
  add column if not exists from_label     text,        -- Anzeige-Name auch wenn Sender gelöscht ist
  add column if not exists reward_payload jsonb,
  add column if not exists claimed_at     timestamptz;

-- Constraint nachträglich (drop+add idempotent)
do $$ begin
  alter table public.user_inbox drop constraint if exists user_inbox_category_check;
  alter table public.user_inbox add constraint user_inbox_category_check
    check (category in ('personal','report','crew','event','system','sent'));
end $$;

create index if not exists idx_user_inbox_category   on public.user_inbox(user_id, category, deleted_at, created_at desc);
create index if not exists idx_user_inbox_subcat     on public.user_inbox(user_id, subcategory) where subcategory is not null;
create index if not exists idx_user_inbox_starred    on public.user_inbox(user_id, is_starred) where is_starred = true;
create index if not exists idx_user_inbox_unclaimed  on public.user_inbox(user_id) where reward_payload is not null and claimed_at is null;

-- ─── 2) Backfill bestehender Zeilen (heuristisch nach Titel) ──────────
-- Alte Spy/Battle/Rally-Reports (aus 00119/00120/00121) re-kategorisieren.
update public.user_inbox set category = 'report', subcategory = 'pvp', kind = 'battle_report'
 where category = 'system'
   and (title ilike '⚔️ Schlachtbericht%' or title ilike '🛡️ Schlachtbericht%'
        or title ilike '⚔️ Aufgebots-Bericht%' or title ilike '🛡️ Crew-Angriff%');

update public.user_inbox set category = 'report', subcategory = 'misc', kind = 'spy_report'
 where category = 'system'
   and title ilike '🔍 Spionage-Bericht%';

update public.user_inbox set category = 'report', subcategory = 'misc', kind = 'spy_warning'
 where category = 'system'
   and title ilike '🔍 Spähtrupp gesichtet%';

-- ─── 3) RLS-Policies erweitern (deleted_at-Filter wird im API gemacht) ─
do $$ begin
  drop policy if exists user_inbox_own_read on public.user_inbox;
  create policy user_inbox_own_read on public.user_inbox for select
    using (auth.uid() = user_id);
end $$;

-- ─── 4) RPC: get_inbox_messages(category, subcategory?, only_unread?) ─
create or replace function public.get_inbox_messages(
  p_category    text,
  p_subcategory text default null,
  p_only_unread boolean default false,
  p_starred_only boolean default false,
  p_limit       int default 100
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select i.id, i.title, i.body, i.read_at, i.created_at,
             i.category, i.subcategory, i.kind, i.payload,
             i.is_starred, i.from_user_id, i.from_label,
             i.reward_payload, i.claimed_at,
             coalesce(u.display_name, u.username, i.from_label, 'System') as from_name,
             u.avatar_url as from_avatar
        from public.user_inbox i
        left join public.users u on u.id = i.from_user_id
       where i.user_id = v_user
         and i.deleted_at is null
         and i.category = p_category
         and (p_subcategory is null or i.subcategory = p_subcategory)
         and (not p_only_unread or i.read_at is null)
         and (not p_starred_only or i.is_starred = true)
       order by i.created_at desc
       limit greatest(1, least(500, p_limit))
    ) r;

  return v_rows;
end $$;
revoke all on function public.get_inbox_messages(text, text, boolean, boolean, int) from public;
grant execute on function public.get_inbox_messages(text, text, boolean, boolean, int) to authenticated;

-- ─── 5) RPC: inbox_counts() — pro Kategorie + Sub ─────────────────────
create or replace function public.inbox_counts()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then return '{}'::jsonb; end if;

  select jsonb_object_agg(coalesce(category, 'unknown'),
    jsonb_build_object('total', total, 'unread', unread,
      'subcategories', subcats))
    into v_result
    from (
      select category,
             count(*)::int as total,
             count(*) filter (where read_at is null)::int as unread,
             coalesce(jsonb_object_agg(subcategory, sub_counts) filter (where subcategory is not null), '{}'::jsonb) as subcats
        from (
          select category, subcategory,
                 count(*)::int as cnt,
                 count(*) filter (where read_at is null)::int as unread_cnt,
                 jsonb_build_object('total', count(*)::int, 'unread', count(*) filter (where read_at is null)::int) as sub_counts
            from public.user_inbox
           where user_id = v_user and deleted_at is null
           group by category, subcategory
        ) g
       group by category
    ) gg;

  return coalesce(v_result, '{}'::jsonb);
end $$;
revoke all on function public.inbox_counts() from public;
grant execute on function public.inbox_counts() to authenticated;

-- ─── 6) RPC: mark_inbox_read(p_ids[]) ─────────────────────────────────
create or replace function public.mark_inbox_read(p_ids uuid[])
returns int language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_count int;
begin
  if v_user is null then return 0; end if;
  with upd as (
    update public.user_inbox set read_at = now()
     where user_id = v_user and id = any(p_ids) and read_at is null
     returning 1
  ) select count(*)::int into v_count from upd;
  return v_count;
end $$;
revoke all on function public.mark_inbox_read(uuid[]) from public;
grant execute on function public.mark_inbox_read(uuid[]) to authenticated;

-- ─── 7) RPC: mark_inbox_deleted(p_ids[]) — Soft-Delete ────────────────
create or replace function public.mark_inbox_deleted(p_ids uuid[])
returns int language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_count int;
begin
  if v_user is null then return 0; end if;
  with upd as (
    update public.user_inbox set deleted_at = now()
     where user_id = v_user and id = any(p_ids) and deleted_at is null
     returning 1
  ) select count(*)::int into v_count from upd;
  return v_count;
end $$;
revoke all on function public.mark_inbox_deleted(uuid[]) from public;
grant execute on function public.mark_inbox_deleted(uuid[]) to authenticated;

-- ─── 8) RPC: delete_all_read(p_category?) ──────────────────────────────
create or replace function public.delete_all_read(p_category text default null)
returns int language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_count int;
begin
  if v_user is null then return 0; end if;
  with upd as (
    update public.user_inbox set deleted_at = now()
     where user_id = v_user
       and read_at is not null
       and deleted_at is null
       and is_starred = false
       and (p_category is null or category = p_category)
     returning 1
  ) select count(*)::int into v_count from upd;
  return v_count;
end $$;
revoke all on function public.delete_all_read(text) from public;
grant execute on function public.delete_all_read(text) to authenticated;

-- ─── 9) RPC: toggle_inbox_star(p_id) ──────────────────────────────────
create or replace function public.toggle_inbox_star(p_id uuid)
returns boolean language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_new boolean;
begin
  if v_user is null then return false; end if;
  update public.user_inbox set is_starred = not is_starred
   where user_id = v_user and id = p_id
   returning is_starred into v_new;
  return coalesce(v_new, false);
end $$;
revoke all on function public.toggle_inbox_star(uuid) from public;
grant execute on function public.toggle_inbox_star(uuid) to authenticated;

-- ─── 10) RPC: claim_inbox_rewards(p_ids?) ─────────────────────────────
-- Buchung der reward_payload-Items in user_resources/etc. + setzt claimed_at.
-- Wenn p_ids null → claimed alle unclaimed Rewards in allen Kategorien.
create or replace function public.claim_inbox_rewards(p_ids uuid[] default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_total_w int := 0; v_total_s int := 0; v_total_g int := 0; v_total_m int := 0; v_total_t int := 0;
  v_n int := 0;
  r record;
  v_w int; v_s int; v_g int; v_mn int; v_t int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  for r in
    select id, reward_payload from public.user_inbox
     where user_id = v_user
       and deleted_at is null
       and reward_payload is not null
       and claimed_at is null
       and (p_ids is null or id = any(p_ids))
  loop
    v_w  := coalesce((r.reward_payload->>'wood')::int, 0);
    v_s  := coalesce((r.reward_payload->>'stone')::int, 0);
    v_g  := coalesce((r.reward_payload->>'gold')::int, 0);
    v_mn := coalesce((r.reward_payload->>'mana')::int, 0);
    v_t  := coalesce((r.reward_payload->>'speed_tokens')::int, 0);

    if (v_w + v_s + v_g + v_mn + v_t) > 0 then
      insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
      values (v_user, v_w, v_s, v_g, v_mn, v_t)
      on conflict (user_id) do update set
        wood         = public.user_resources.wood + excluded.wood,
        stone        = public.user_resources.stone + excluded.stone,
        gold         = public.user_resources.gold + excluded.gold,
        mana         = public.user_resources.mana + excluded.mana,
        speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
        updated_at   = now();
    end if;

    update public.user_inbox set claimed_at = now(), read_at = coalesce(read_at, now())
     where id = r.id;
    v_total_w := v_total_w + v_w; v_total_s := v_total_s + v_s;
    v_total_g := v_total_g + v_g; v_total_m := v_total_m + v_mn;
    v_total_t := v_total_t + v_t; v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true,
    'claimed_count', v_n,
    'wood', v_total_w, 'stone', v_total_s,
    'gold', v_total_g, 'mana', v_total_m,
    'speed_tokens', v_total_t);
end $$;
revoke all on function public.claim_inbox_rewards(uuid[]) from public;
grant execute on function public.claim_inbox_rewards(uuid[]) to authenticated;

-- ─── 11) RPC: send_personal_message(p_to_user, p_title, p_body) ───────
create or replace function public.send_personal_message(
  p_to_user uuid, p_title text, p_body text
) returns uuid language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_from_name text;
  v_to_name   text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_user = p_to_user then raise exception 'cannot_message_self'; end if;

  select coalesce(display_name, username, 'Unbekannt') into v_from_name from public.users where id = v_user;
  select coalesce(display_name, username, 'Unbekannt') into v_to_name from public.users where id = p_to_user;
  if v_to_name is null then raise exception 'recipient_not_found'; end if;

  -- Empfänger-Kopie
  insert into public.user_inbox (user_id, category, kind, title, body, from_user_id, from_label)
  values (p_to_user, 'personal', 'personal_message', p_title, p_body, v_user, v_from_name)
  returning id into v_id;

  -- Sender-Kopie (Gesendet-Tab)
  insert into public.user_inbox (user_id, category, kind, title, body, from_user_id, from_label)
  values (v_user, 'sent', 'personal_message', '→ ' || v_to_name || ': ' || p_title, p_body, p_to_user, v_to_name);

  return v_id;
end $$;
revoke all on function public.send_personal_message(uuid, text, text) from public;
grant execute on function public.send_personal_message(uuid, text, text) to authenticated;

-- ─── 12) RPC: post_crew_message(subcategory, title, body) ─────────────
-- Crew-Leader/Officer postet — Distribution an alle Crew-Mitglieder.
create or replace function public.post_crew_message(
  p_subcategory text, p_title text, p_body text
) returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_from_name text;
  v_count int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_subcategory not in ('decree', 'announcement', 'bounty', 'build_report') then
    raise exception 'invalid_subcategory';
  end if;

  select crew_id, role into v_crew, v_role from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then raise exception 'no_crew'; end if;
  if v_role not in ('owner','admin') then raise exception 'not_authorized'; end if;

  select coalesce(display_name, username, 'Anführer') into v_from_name from public.users where id = v_user;

  -- An alle Crew-Mitglieder verteilen
  insert into public.user_inbox (user_id, category, subcategory, kind, title, body, from_user_id, from_label)
  select cm.user_id, 'crew', p_subcategory, 'crew_post', p_title, p_body, v_user, v_from_name
    from public.crew_members cm
   where cm.crew_id = v_crew;
  get diagnostics v_count = row_count;

  return v_count;
end $$;
revoke all on function public.post_crew_message(text, text, text) from public;
grant execute on function public.post_crew_message(text, text, text) to authenticated;

-- ─── 13) Trigger: Auto-Kategorisierung beim INSERT ───────────────────
-- Damit alte RPCs (Spy/Attack/Rally) nicht angefasst werden müssen,
-- taggt ein BEFORE-INSERT-Trigger Rows automatisch nach Titel-Pattern.
create or replace function public._tg_inbox_auto_categorize()
returns trigger language plpgsql as $$
begin
  -- Nur wenn Caller noch nicht explizit kategorisiert hat
  if new.category = 'system' and new.subcategory is null and new.kind is null then
    if new.title ilike '⚔️ Schlachtbericht%' or new.title ilike '🛡️ Schlachtbericht%' then
      new.category := 'report'; new.subcategory := 'pvp'; new.kind := 'battle_report';
    elsif new.title ilike '⚔️ Aufgebots-Bericht%' or new.title ilike '🛡️ Crew-Angriff%' then
      new.category := 'report'; new.subcategory := 'pvp'; new.kind := 'rally_report';
    elsif new.title ilike '🔍 Spionage-Bericht%' then
      new.category := 'report'; new.subcategory := 'misc'; new.kind := 'spy_report';
    elsif new.title ilike '🔍 Spähtrupp gesichtet%' then
      new.category := 'report'; new.subcategory := 'misc'; new.kind := 'spy_warning';
    elsif new.title ilike 'Event%' or new.title ilike '%Event %' or new.title ilike '%-Buff aktiviert%' then
      new.category := 'event';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tg_inbox_auto_categorize on public.user_inbox;
create trigger tg_inbox_auto_categorize before insert on public.user_inbox
  for each row execute function public._tg_inbox_auto_categorize();
-- mit neuen Kategorien getaggt. Alte Funktionen patchen: nur category +
-- subcategory + kind setzen, body bleibt.
-- (Implementierung in den jeweiligen RPCs siehe vorherige Migrationen.
--  Hier wird der Default category='system' beibehalten, falls eine alte
--  RPC noch unverändert insertet — die Migration in 00126 patcht sie.)
