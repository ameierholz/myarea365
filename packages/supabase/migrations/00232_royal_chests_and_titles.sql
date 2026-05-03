-- 00232_royal_chests_and_titles.sql
-- Königliche Truhen + Titel: Stadtherr verteilt an Untertanen.

create table if not exists public.royal_chests (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid references public.city_lord_seasons(id) on delete cascade,
  lord_user_id      uuid not null references public.users(id),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  chest_kind        text not null check (chest_kind in ('conqueror','defender','supporter')),
  gems              int not null default 0,
  items             jsonb not null default '[]'::jsonb,
  sent_at           timestamptz not null default now(),
  claimed_at        timestamptz,
  claimed           boolean not null default false
);

create table if not exists public.user_titles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  title_kind    text not null,
  granted_by    uuid references public.users(id),
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz,
  buff_payload  jsonb not null default '{}'::jsonb
);

create index if not exists royal_chests_recipient_idx on public.royal_chests(recipient_user_id, claimed);
create index if not exists user_titles_user_idx on public.user_titles(user_id, expires_at);

alter table public.royal_chests enable row level security;
alter table public.user_titles  enable row level security;
drop policy if exists "royal_chests_read_self" on public.royal_chests;
create policy "royal_chests_read_self" on public.royal_chests for select
  using (recipient_user_id = auth.uid() or lord_user_id = auth.uid());
drop policy if exists "user_titles_read_self" on public.user_titles;
create policy "user_titles_read_self" on public.user_titles for select using (true);

create or replace function public.is_current_city_lord(p_user uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.city_lord cl
    join public.city_lord_seasons s on s.id = cl.season_id
    where cl.user_id = p_user and s.status = 'active'
  );
$$;

create or replace function public.lord_send_royal_chest(p_recipient uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_season uuid;
  v_gems int;
  v_items jsonb;
  v_id uuid;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if not public.is_current_city_lord(v_uid) then raise exception 'not_city_lord'; end if;
  if p_kind not in ('conqueror','defender','supporter') then raise exception 'bad_kind'; end if;
  select cl.season_id into v_season from public.city_lord cl
    join public.city_lord_seasons s on s.id = cl.season_id
    where cl.user_id = v_uid and s.status='active' limit 1;

  v_gems := case p_kind when 'conqueror' then 500 when 'defender' then 300 else 150 end;
  v_items := case p_kind
    when 'conqueror' then jsonb_build_array(jsonb_build_object('catalog_id','chest_legendary','count',1))
    when 'defender'  then jsonb_build_array(jsonb_build_object('catalog_id','chest_gold','count',2))
    else                  jsonb_build_array(jsonb_build_object('catalog_id','chest_silver','count',3))
  end;

  insert into public.royal_chests (season_id, lord_user_id, recipient_user_id, chest_kind, gems, items)
  values (v_season, v_uid, p_recipient, p_kind, v_gems, v_items) returning id into v_id;

  insert into public.user_inbox (user_id, title, body, category, kind, payload, reward_payload, from_label, from_user_id)
  values (p_recipient, 'Königliche Truhe',
          'Der Stadtherr hat dir eine '||p_kind||'-Truhe gesandt.',
          'reward', 'royal_chest',
          jsonb_build_object('chest_id', v_id, 'kind', p_kind),
          jsonb_build_object('gems', v_gems, 'items', v_items),
          'Stadtherr', v_uid);
  return v_id;
end; $$;

create or replace function public.lord_grant_title(p_recipient uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_buff jsonb;
  v_expires timestamptz;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if not public.is_current_city_lord(v_uid) then raise exception 'not_city_lord'; end if;

  if p_title = 'vize_stadtherr' then
    v_buff := jsonb_build_object('build_speed_pct', 10, 'gather_speed_pct', 10);
    v_expires := now() + interval '7 days';
  elsif p_title = 'general' then
    v_buff := jsonb_build_object('troop_atk_pct', 10);
    v_expires := now() + interval '7 days';
  elsif p_title = 'schurke' then
    v_buff := jsonb_build_object('build_speed_pct', -20);
    v_expires := now() + interval '7 days';
  else
    v_buff := '{}'::jsonb;
    v_expires := now() + interval '7 days';
  end if;

  insert into public.user_titles (user_id, title_kind, granted_by, expires_at, buff_payload)
  values (p_recipient, p_title, v_uid, v_expires, v_buff) returning id into v_id;

  insert into public.user_inbox (user_id, title, body, category, kind, payload, from_label, from_user_id)
  values (p_recipient, 'Titel verliehen: '||p_title,
          'Der Stadtherr hat dir den Titel "'||p_title||'" verliehen.',
          'system', 'title_granted',
          jsonb_build_object('title', p_title, 'expires_at', v_expires, 'buff', v_buff),
          'Stadtherr', v_uid);
  return v_id;
end; $$;

create or replace function public.claim_royal_chest(p_chest_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_chest public.royal_chests%rowtype;
  v_item jsonb;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select * into v_chest from public.royal_chests where id = p_chest_id for update;
  if not found then raise exception 'chest_not_found'; end if;
  if v_chest.recipient_user_id <> v_uid then raise exception 'forbidden'; end if;
  if v_chest.claimed then return jsonb_build_object('ok', false, 'error', 'already_claimed'); end if;

  if v_chest.gems > 0 then
    insert into public.user_gems (user_id, gems) values (v_uid, v_chest.gems)
    on conflict (user_id) do update set gems = user_gems.gems + v_chest.gems, updated_at = now();
    insert into public.gem_transactions (user_id, delta, reason, metadata)
    values (v_uid, v_chest.gems, 'royal_chest', jsonb_build_object('chest_id', p_chest_id, 'kind', v_chest.chest_kind));
  end if;
  for v_item in select * from jsonb_array_elements(v_chest.items) loop
    perform public.grant_inventory_item(v_uid, v_item->>'catalog_id', coalesce((v_item->>'count')::int, 1));
  end loop;
  update public.royal_chests set claimed = true, claimed_at = now() where id = p_chest_id;
  return jsonb_build_object('ok', true, 'gems', v_chest.gems, 'items', v_chest.items);
end; $$;

revoke all on function public.lord_send_royal_chest(uuid, text) from public;
revoke all on function public.lord_grant_title(uuid, text) from public;
revoke all on function public.claim_royal_chest(uuid) from public;
grant execute on function public.lord_send_royal_chest(uuid, text) to authenticated;
grant execute on function public.lord_grant_title(uuid, text) to authenticated;
grant execute on function public.claim_royal_chest(uuid) to authenticated;
