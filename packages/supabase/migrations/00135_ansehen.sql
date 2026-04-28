-- ════════════════════════════════════════════════════════════════════
-- ANSEHEN — Power-/Might-Score à la RoK/CoD
-- ════════════════════════════════════════════════════════════════════
-- Quellen:
--   • Gebäude-Upgrade   = level² × 10
--   • Forschung         = level × 50
--   • Truppen-Training  = (atk + def + hp) pro Einheit
--   • Wächter-Level-Up  = level × 20
--   • Crew-Repeater Bau = HQ 5000 / Mega 2000 / Repeater 500
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Schema ─────────────────────────────────────────────────────
alter table public.users add column if not exists ansehen bigint not null default 0;

create table if not exists public.ansehen_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  source      text not null,
  delta       int  not null,
  ref_id      uuid,
  created_at  timestamptz not null default now()
);
create index if not exists ansehen_log_user_idx on public.ansehen_log(user_id, created_at desc);

alter table public.ansehen_log enable row level security;
drop policy if exists ansehen_log_read_own on public.ansehen_log;
create policy ansehen_log_read_own on public.ansehen_log
  for select using (user_id = auth.uid());

-- ─── 2) Helper: zentral Ansehen vergeben ──────────────────────────
create or replace function public._grant_ansehen(
  p_user_id uuid, p_source text, p_delta int, p_ref uuid default null
) returns void language plpgsql security definer as $$
begin
  if p_user_id is null or p_delta is null or p_delta = 0 then return; end if;
  update public.users set ansehen = coalesce(ansehen, 0) + p_delta where id = p_user_id;
  insert into public.ansehen_log (user_id, source, delta, ref_id)
  values (p_user_id, p_source, p_delta, p_ref);
end $$;

-- ─── 3) Hook: finish_building (level² × 10) ───────────────────────
create or replace function public.finish_building()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_count int := 0;
  q record;
  v_grant int;
begin
  if v_user is null then return 0; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then return 0; end if;

  for q in
    select * from public.building_queue
     where base_id = v_base_id and not finished and ends_at <= now()
     order by ends_at
  loop
    update public.base_buildings set
      level = q.target_level, status = 'idle', last_collected_at = coalesce(last_collected_at, now())
    where base_id = v_base_id and building_id = q.building_id;

    update public.building_queue set finished = true where id = q.id;

    v_grant := (q.target_level * q.target_level * 10);
    perform public._grant_ansehen(v_user, 'build', v_grant, q.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ─── 4) Hook: finish_research (level × 50) ────────────────────────
create or replace function public.finish_research()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_count int := 0;
  q record;
begin
  if v_user is null then return 0; end if;
  for q in
    select * from public.research_queue
     where user_id = v_user and not finished and ends_at <= now()
     order by ends_at
  loop
    insert into public.user_research (user_id, research_id, level)
    values (v_user, q.research_id, q.target_level)
    on conflict (user_id, research_id) do update set level = excluded.level;
    update public.research_queue set finished = true where id = q.id;

    perform public._grant_ansehen(v_user, 'research', q.target_level * 50, q.id);

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ─── 5) Hook: finish_troop_training (atk+def+hp pro Einheit) ──────
create or replace function public.finish_troop_training()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  q record; v_count int := 0;
  v_stats record;
  v_grant int;
begin
  if v_user is null then return 0; end if;
  for q in
    select * from public.troop_training_queue
     where not finished and ends_at <= now()
       and (user_id = v_user or crew_id in (select crew_id from public.crew_members where user_id = v_user))
     order by ends_at
  loop
    if q.user_id is not null then
      insert into public.user_troops (user_id, troop_id, count)
      values (q.user_id, q.troop_id, q.count)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
    else
      insert into public.crew_troops (crew_id, troop_id, count)
      values (q.crew_id, q.troop_id, q.count)
      on conflict (crew_id, troop_id) do update set count = public.crew_troops.count + excluded.count;
    end if;
    update public.troop_training_queue set finished = true where id = q.id;

    -- Ansehen: pro Einheit (atk+def+hp); Crew-Training zählt dem auslösenden User
    select base_atk, base_def, base_hp into v_stats from public.troops_catalog where id = q.troop_id;
    if v_stats is not null then
      v_grant := q.count * (coalesce(v_stats.base_atk,0) + coalesce(v_stats.base_def,0) + coalesce(v_stats.base_hp,0));
      perform public._grant_ansehen(coalesce(q.user_id, v_user), 'train', v_grant, q.id);
    end if;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ─── 6) Hook: place_crew_repeater (HQ 5000 / Mega 2000 / Repeater 500) ─
create or replace function public.place_crew_repeater(
  p_lat double precision,
  p_lng double precision,
  p_kind text default 'repeater',
  p_label text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing_count int;
  v_in_chain boolean;
  v_stats record;
  v_repeater_id uuid;
  v_res record;
  v_ansehen int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_kind not in ('hq','repeater','mega') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select * into v_stats from public._repeater_kind_stats(p_kind);

  select count(*) into v_existing_count
    from public.crew_repeaters
   where crew_id = v_crew and destroyed_at is null;

  if v_existing_count = 0 and p_kind <> 'hq' then
    return jsonb_build_object('ok', false, 'error', 'first_must_be_hq');
  end if;
  if p_kind = 'hq' and v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'hq_already_exists');
  end if;

  if p_kind <> 'hq' then
    select exists (
      select 1 from public.crew_repeaters
       where crew_id = v_crew
         and destroyed_at is null
         and public._haversine_m(lat, lng, p_lat, p_lng) <= public._repeater_chain_radius_m()
    ) into v_in_chain;
    if not v_in_chain then
      return jsonb_build_object('ok', false, 'error', 'out_of_chain');
    end if;
  end if;

  if exists (
    select 1 from public.crew_repeaters
     where crew_id <> v_crew
       and destroyed_at is null
       and public._haversine_m(lat, lng, p_lat, p_lng) <= 50
  ) then
    return jsonb_build_object('ok', false, 'error', 'too_close_to_enemy');
  end if;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res from public.user_resources where user_id = v_user;

  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood or v_res.stone < v_stats.cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood, 'stone', v_stats.cost_stone));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone
   where user_id = v_user;

  insert into public.crew_repeaters (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, shield_until
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, initcap(p_kind)), p_lat, p_lng,
    v_stats.max_hp, v_stats.max_hp,
    now() + (v_stats.build_shield_s || ' seconds')::interval
  )
  returning id into v_repeater_id;

  v_ansehen := case p_kind when 'hq' then 5000 when 'mega' then 2000 else 500 end;
  perform public._grant_ansehen(v_user, 'repeater', v_ansehen, v_repeater_id);

  return jsonb_build_object('ok', true, 'repeater_id', v_repeater_id, 'kind', p_kind, 'hp', v_stats.max_hp);
end $$;

grant execute on function public.place_crew_repeater(double precision, double precision, text, text) to authenticated;

-- ─── 7) Trigger: Wächter-Level-Up ─────────────────────────────────
create or replace function public._trg_guardian_level_ansehen() returns trigger language plpgsql as $$
declare
  v_delta int;
begin
  if new.level is distinct from old.level and new.level > coalesce(old.level, 0) then
    v_delta := (new.level - coalesce(old.level, 0)) * new.level * 20;  -- approx: jeder gewonnene Level gewichtet
    perform public._grant_ansehen(new.user_id, 'guardian', v_delta, new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_guardian_level_ansehen on public.user_guardians;
create trigger trg_guardian_level_ansehen
  after update of level on public.user_guardians
  for each row execute function public._trg_guardian_level_ansehen();

-- ─── 8) Backfill für bestehende Bestände ───────────────────────────
do $$
declare
  v_user uuid;
  v_total bigint;
begin
  for v_user in select id from public.users loop
    v_total := 0;

    -- Gebäude (level² × 10 pro aktuelles Level)
    v_total := v_total + coalesce((
      select sum(bb.level * bb.level * 10)::bigint
        from public.bases b
        join public.base_buildings bb on bb.base_id = b.id
       where b.owner_user_id = v_user and bb.level > 0
    ), 0);

    -- Forschung
    v_total := v_total + coalesce((
      select sum(level * 50)::bigint
        from public.user_research
       where user_id = v_user
    ), 0);

    -- Truppen (eigener Bestand)
    v_total := v_total + coalesce((
      select sum(ut.count * (coalesce(t.base_atk,0) + coalesce(t.base_def,0) + coalesce(t.base_hp,0)))::bigint
        from public.user_troops ut
        join public.troops_catalog t on t.id = ut.troop_id
       where ut.user_id = v_user
    ), 0);

    -- Wächter
    v_total := v_total + coalesce((
      select sum(level * level * 20)::bigint  -- approx Summe aller Level-Ups bis level
        from public.user_guardians
       where user_id = v_user
    ), 0);

    -- Crew-Repeater (founder bekommt Credit)
    v_total := v_total + coalesce((
      select sum(case kind when 'hq' then 5000 when 'mega' then 2000 else 500 end)::bigint
        from public.crew_repeaters
       where founder_user_id = v_user and destroyed_at is null
    ), 0);

    if v_total > 0 then
      update public.users set ansehen = v_total where id = v_user;
      insert into public.ansehen_log (user_id, source, delta) values (v_user, 'backfill', v_total::int);
    end if;
  end loop;
end $$;

-- ─── 9) Convenience: Leaderboard-View ──────────────────────────────
create or replace view public.v_ansehen_leaderboard as
  select u.id as user_id, u.username, u.display_name, u.ansehen,
         row_number() over (order by u.ansehen desc) as rank
    from public.users u
   where u.ansehen > 0;

grant select on public.v_ansehen_leaderboard to authenticated;
