-- ══════════════════════════════════════════════════════════════════════════
-- Phase 4 — Mentor-System
--
-- Senior (xp >= 5000) kann bis zu 3 Mentees adoptieren. Pro Walk des Mentees
-- bekommen BEIDE +50 Wegemünzen Bonus. Mentor-Beziehung läuft 30 Tage,
-- danach automatisch graduate (mit 500 Münzen Belohnung). Mentee max 1 Mentor.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.mentor_relationships (
  id              uuid primary key default gen_random_uuid(),
  mentor_user_id  uuid not null references public.users(id) on delete cascade,
  mentee_user_id  uuid not null references public.users(id) on delete cascade,
  status          text not null default 'active' check (status in ('active', 'graduated', 'cancelled')),
  started_at      timestamptz not null default now(),
  graduates_at    timestamptz not null default (now() + interval '30 days'),
  ended_at        timestamptz,
  walks_together  integer not null default 0,
  total_bonus_coins integer not null default 0,
  unique (mentor_user_id, mentee_user_id),
  check (mentor_user_id <> mentee_user_id)
);

create index if not exists idx_mentor_active on public.mentor_relationships(mentor_user_id) where status = 'active';
create index if not exists idx_mentee_active on public.mentor_relationships(mentee_user_id) where status = 'active';

alter table public.mentor_relationships enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='mentor_relationships' and policyname='read_own') then
    create policy read_own on public.mentor_relationships
      for select using (auth.uid() = mentor_user_id or auth.uid() = mentee_user_id);
  end if;
end $$;

create or replace function public.create_mentor_relationship(p_mentee_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_mentor uuid := auth.uid();
  v_mentor_xp int;
  v_existing_count int;
begin
  if v_mentor is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if v_mentor = p_mentee_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_mentor_self'); end if;

  select coalesce(xp, 0) into v_mentor_xp from public.users where id = v_mentor;
  if v_mentor_xp < 5000 then
    return jsonb_build_object('ok', false, 'error', 'mentor_xp_required', 'message', 'Mentor benötigt 5000 XP');
  end if;

  if exists (select 1 from public.mentor_relationships where mentee_user_id = p_mentee_user_id and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'mentee_already_has_mentor');
  end if;

  select count(*) into v_existing_count from public.mentor_relationships
   where mentor_user_id = v_mentor and status = 'active';
  if v_existing_count >= 3 then
    return jsonb_build_object('ok', false, 'error', 'mentor_full', 'message', 'Du hast bereits 3 aktive Mentees');
  end if;

  insert into public.mentor_relationships (mentor_user_id, mentee_user_id)
  values (v_mentor, p_mentee_user_id);

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.create_mentor_relationship(uuid) from public;
grant execute on function public.create_mentor_relationship(uuid) to authenticated;

create or replace function public.get_mentor_status()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_mentor jsonb;
  v_mentees jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select jsonb_build_object(
    'rel_id', mr.id,
    'mentor_user_id', mr.mentor_user_id,
    'mentor_name', u.display_name,
    'started_at', mr.started_at,
    'graduates_at', mr.graduates_at,
    'walks_together', mr.walks_together,
    'total_bonus_coins', mr.total_bonus_coins
  ) into v_mentor
  from public.mentor_relationships mr
  join public.users u on u.id = mr.mentor_user_id
  where mr.mentee_user_id = v_user and mr.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'rel_id', mr.id,
    'mentee_user_id', mr.mentee_user_id,
    'mentee_name', u.display_name,
    'started_at', mr.started_at,
    'graduates_at', mr.graduates_at,
    'walks_together', mr.walks_together,
    'total_bonus_coins', mr.total_bonus_coins
  )), '[]'::jsonb) into v_mentees
  from public.mentor_relationships mr
  join public.users u on u.id = mr.mentee_user_id
  where mr.mentor_user_id = v_user and mr.status = 'active';

  return jsonb_build_object('ok', true, 'my_mentor', v_mentor, 'my_mentees', v_mentees);
end $$;

revoke all on function public.get_mentor_status() from public;
grant execute on function public.get_mentor_status() to authenticated;

create or replace function public.process_mentor_walk_bonus(p_mentee_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_rel record;
  v_bonus int := 50;
begin
  select * into v_rel from public.mentor_relationships
   where mentee_user_id = p_mentee_user_id and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'has_mentor', false);
  end if;

  if v_rel.graduates_at < now() then
    update public.mentor_relationships set status = 'graduated', ended_at = now() where id = v_rel.id;
    update public.users set wegemuenzen = coalesce(wegemuenzen, 0) + 500, xp = coalesce(xp, 0) + 500
      where id = v_rel.mentor_user_id;
    return jsonb_build_object('ok', true, 'graduated', true);
  end if;

  update public.users set wegemuenzen = coalesce(wegemuenzen, 0) + v_bonus, xp = coalesce(xp, 0) + v_bonus
    where id in (v_rel.mentor_user_id, v_rel.mentee_user_id);
  update public.mentor_relationships
     set walks_together = walks_together + 1,
         total_bonus_coins = total_bonus_coins + v_bonus * 2
   where id = v_rel.id;

  return jsonb_build_object('ok', true, 'bonus_each', v_bonus);
end $$;

revoke all on function public.process_mentor_walk_bonus(uuid) from public;
grant execute on function public.process_mentor_walk_bonus(uuid) to authenticated;
