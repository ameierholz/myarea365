-- 00231_city_lord.sql
-- Stadtherr (KvK-Sieger) — pro Saison ein User. RPC wird vom KvK-Endboss-Sieg-Trigger gerufen.

create table if not exists public.city_lord_seasons (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  ends_at      timestamptz,
  status       text not null default 'active' check (status in ('active','ended')),
  city_label   text
);

create table if not exists public.city_lord (
  season_id      uuid primary key references public.city_lord_seasons(id) on delete cascade,
  user_id        uuid not null references public.users(id),
  crew_id        uuid references public.crews(id),
  took_office_at timestamptz not null default now()
);

alter table public.city_lord_seasons enable row level security;
alter table public.city_lord enable row level security;
drop policy if exists "city_lord_seasons_read_all" on public.city_lord_seasons;
create policy "city_lord_seasons_read_all" on public.city_lord_seasons for select using (true);
drop policy if exists "city_lord_read_all" on public.city_lord;
create policy "city_lord_read_all" on public.city_lord for select using (true);

create or replace function public.claim_city_lordship(p_season_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_season public.city_lord_seasons%rowtype;
  v_crew uuid;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  -- Erlaubt: Self-Claim (vom Trigger im Auth-Kontext) ODER Admin-Push
  select role::text into v_caller_role from public.users where id = v_uid;
  select * into v_season from public.city_lord_seasons where id = p_season_id;
  if not found then raise exception 'season_not_found'; end if;
  if v_season.status <> 'active' then raise exception 'season_not_active'; end if;
  if exists (select 1 from public.city_lord where season_id = p_season_id) then
    raise exception 'already_claimed';
  end if;
  select current_crew_id into v_crew from public.users where id = v_uid;
  insert into public.city_lord (season_id, user_id, crew_id) values (p_season_id, v_uid, v_crew);

  insert into public.user_inbox (user_id, title, body, category, kind, payload, from_label)
  values (v_uid, 'Du bist Stadtherr!',
          'Glückwunsch — du regierst diese Saison.',
          'system', 'city_lord', jsonb_build_object('season_id', p_season_id), 'Krone');
  return jsonb_build_object('ok', true, 'season_id', p_season_id);
end; $$;

revoke all on function public.claim_city_lordship(uuid) from public;
grant execute on function public.claim_city_lordship(uuid) to authenticated;

-- Seed: 1 aktive Saison
insert into public.city_lord_seasons (city_label, status) values ('Saison 1', 'active')
on conflict do nothing;
