-- ══════════════════════════════════════════════════════════════════════════
-- RALLY-SYSTEM (Crew-Sammelangriff auf Schattenhorte)
-- ══════════════════════════════════════════════════════════════════════════
-- Crew-Leader öffnet Rally → Crew-Mitglieder können in der Prep-Phase
-- beitreten. Wenn Prep abläuft: marsch zu Stronghold, Combat, Loot-Verteilung.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) rallies — Haupt-Tabelle ──────────────────────────────────────────
create table if not exists public.rallies (
  id              uuid primary key default gen_random_uuid(),
  leader_user_id  uuid not null references public.users(id) on delete cascade,
  crew_id         uuid not null references public.crews(id) on delete cascade,
  stronghold_id   uuid not null references public.strongholds(id) on delete cascade,
  prep_seconds    int  not null check (prep_seconds in (180, 480, 1680, 28680)), -- 3 / 8 / 28 / 478 min
  prep_ends_at    timestamptz not null,
  march_ends_at   timestamptz,                  -- nach Prep gesetzt: prep_ends_at + march_distance_seconds
  status          text not null default 'preparing'
                  check (status in ('preparing','marching','fighting','done','aborted')),
  outcome         text check (outcome in ('victory','defeat','timeout')),
  total_atk       bigint default 0,
  total_hp_dealt  bigint default 0,
  loot            jsonb,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists idx_rallies_crew on public.rallies(crew_id, status);
create index if not exists idx_rallies_open on public.rallies(prep_ends_at) where status = 'preparing';
create index if not exists idx_rallies_marching on public.rallies(march_ends_at) where status = 'marching';

alter table public.rallies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='rallies' and policyname='select_member') then
    create policy select_member on public.rallies for select using (
      exists (select 1 from public.crew_members cm where cm.crew_id = rallies.crew_id and cm.user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 2) rally_participants — pro User: Wächter + Truppen ─────────────────
create table if not exists public.rally_participants (
  rally_id        uuid not null references public.rallies(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  guardian_id     uuid references public.user_guardians(id) on delete set null,
  troops          jsonb not null default '{}'::jsonb,  -- {troop_id: count}
  atk_contribution bigint default 0,
  joined_at       timestamptz not null default now(),
  primary key (rally_id, user_id)
);
create index if not exists idx_rally_part_user on public.rally_participants(user_id);

alter table public.rally_participants enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='rally_participants' and policyname='select_self_or_crew') then
    create policy select_self_or_crew on public.rally_participants for select using (
      user_id = auth.uid() or exists (
        select 1 from public.rallies r join public.crew_members cm on cm.crew_id = r.crew_id
        where r.id = rally_participants.rally_id and cm.user_id = auth.uid()
      )
    );
  end if;
end $$;

-- ─── 3) Helper: berechne Truppen-ATK-Summe + sperre Truppen ──────────────
create or replace function public._reserve_user_troops(p_user uuid, p_troops jsonb)
returns bigint language plpgsql as $$
declare
  v_key text;
  v_count int;
  v_have int;
  v_total_atk bigint := 0;
  v_atk int;
begin
  -- Alle requested Counts gegen Lager prüfen
  for v_key, v_count in select * from jsonb_each_text(p_troops) loop
    if v_count::int <= 0 then continue; end if;
    select coalesce(count, 0) into v_have from public.user_troops where user_id = p_user and troop_id = v_key;
    if coalesce(v_have, 0) < v_count::int then
      raise exception 'not_enough_troops:%', v_key;
    end if;
    select base_atk into v_atk from public.troops_catalog where id = v_key;
    if v_atk is null then raise exception 'invalid_troop:%', v_key; end if;
    v_total_atk := v_total_atk + (v_atk::bigint * v_count::int);
  end loop;
  -- Wenn alles passt → abziehen
  for v_key, v_count in select * from jsonb_each_text(p_troops) loop
    if v_count::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_count::int
     where user_id = p_user and troop_id = v_key;
  end loop;
  return v_total_atk;
end $$;

-- ─── 4) start_rally(stronghold_id, prep_seconds, guardian_id, troops) ────
create or replace function public.start_rally(
  p_stronghold_id uuid,
  p_prep_seconds  int,
  p_guardian_id   uuid,
  p_troops        jsonb
)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing int;
  v_atk bigint;
  v_rally_id uuid;
  v_sh record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_prep_seconds not in (180, 480, 1680, 28680) then
    return jsonb_build_object('ok', false, 'error', 'invalid_prep_seconds');
  end if;
  if jsonb_typeof(p_troops) <> 'object' or p_troops = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'error', 'no_troops_selected');
  end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'not_in_crew'); end if;

  select * into v_sh from public.strongholds where id = p_stronghold_id;
  if v_sh is null or v_sh.defeated_at is not null then
    return jsonb_build_object('ok', false, 'error', 'stronghold_not_available');
  end if;

  -- Eine offene Rally pro Crew
  select count(*) into v_existing from public.rallies
   where crew_id = v_crew and status in ('preparing','marching','fighting');
  if v_existing > 0 then
    return jsonb_build_object('ok', false, 'error', 'rally_already_active');
  end if;

  -- Guardian-Owner-Check
  if p_guardian_id is not null then
    if not exists (select 1 from public.user_guardians where id = p_guardian_id and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'guardian_not_owned');
    end if;
  end if;

  -- Truppen abziehen + ATK berechnen
  v_atk := public._reserve_user_troops(v_user, p_troops);

  insert into public.rallies (leader_user_id, crew_id, stronghold_id, prep_seconds, prep_ends_at)
  values (v_user, v_crew, p_stronghold_id, p_prep_seconds, now() + (p_prep_seconds || ' seconds')::interval)
  returning id into v_rally_id;

  insert into public.rally_participants (rally_id, user_id, guardian_id, troops, atk_contribution)
  values (v_rally_id, v_user, p_guardian_id, p_troops, v_atk);

  update public.rallies set total_atk = v_atk where id = v_rally_id;

  return jsonb_build_object('ok', true, 'rally_id', v_rally_id, 'prep_ends_at', now() + (p_prep_seconds || ' seconds')::interval);
end $$;
revoke all on function public.start_rally(uuid, int, uuid, jsonb) from public;
grant execute on function public.start_rally(uuid, int, uuid, jsonb) to authenticated;

-- ─── 5) join_rally(rally_id, guardian_id, troops) ────────────────────────
create or replace function public.join_rally(p_rally_id uuid, p_guardian_id uuid, p_troops jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_rally record;
  v_atk bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_rally from public.rallies where id = p_rally_id for update;
  if v_rally is null then return jsonb_build_object('ok', false, 'error', 'rally_not_found'); end if;
  if v_rally.status <> 'preparing' or v_rally.prep_ends_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'rally_locked');
  end if;
  if not exists (select 1 from public.crew_members where crew_id = v_rally.crew_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'not_in_crew');
  end if;
  if exists (select 1 from public.rally_participants where rally_id = p_rally_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;
  if jsonb_typeof(p_troops) <> 'object' or p_troops = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'error', 'no_troops_selected');
  end if;
  if p_guardian_id is not null then
    if not exists (select 1 from public.user_guardians where id = p_guardian_id and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'guardian_not_owned');
    end if;
  end if;

  v_atk := public._reserve_user_troops(v_user, p_troops);
  insert into public.rally_participants (rally_id, user_id, guardian_id, troops, atk_contribution)
  values (p_rally_id, v_user, p_guardian_id, p_troops, v_atk);
  update public.rallies set total_atk = total_atk + v_atk where id = p_rally_id;

  return jsonb_build_object('ok', true, 'atk_added', v_atk);
end $$;
revoke all on function public.join_rally(uuid, uuid, jsonb) from public;
grant execute on function public.join_rally(uuid, uuid, jsonb) to authenticated;

-- ─── 6) resolve_due_rallies() — Cron-Job ──────────────────────────────────
-- Phase A: preparing → marching (wenn prep abgelaufen, march-Zeit = 60s pauschal)
-- Phase B: marching → fighting → done (Combat sofort nach Ankunft)
create or replace function public.resolve_due_rallies()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r record;
  p record;
  v_sh record;
  v_total_atk bigint;
  v_total_hp bigint;
  v_outcome text;
  v_loss_pct numeric;
  v_share numeric;
  v_loot_per_resource bigint;
  v_t record;
  v_lost int;
  v_kept int;
  v_key text;
  v_count_committed int;
begin
  -- Phase A: preparing → marching (60s pauschal)
  for r in select * from public.rallies where status = 'preparing' and prep_ends_at <= now() loop
    update public.rallies
       set status = 'marching', march_ends_at = now() + interval '60 seconds'
     where id = r.id;
    v_count := v_count + 1;
  end loop;

  -- Phase B: marching → done (Combat-Resolution)
  for r in select * from public.rallies where status = 'marching' and march_ends_at <= now() loop
    select * into v_sh from public.strongholds where id = r.stronghold_id for update;
    v_total_atk := r.total_atk;
    v_total_hp := coalesce(v_sh.current_hp, 0);

    if v_total_atk >= v_total_hp and v_sh.defeated_at is null then
      v_outcome := 'victory';
      v_loss_pct := 0.25;  -- 25% Truppen verloren
      update public.strongholds
         set current_hp = 0, defeated_at = now(),
             defeated_by_crew = r.crew_id,
             respawn_at = now() + interval '6 hours'
       where id = v_sh.id;
    else
      v_outcome := 'defeat';
      v_loss_pct := 0.50;  -- 50% Truppen verloren
      if v_sh.defeated_at is null then
        update public.strongholds
           set current_hp = greatest(0, v_total_hp - v_total_atk)
         where id = v_sh.id;
      end if;
    end if;

    -- Truppen-Verluste + Wächter-XP + Loot-Anteil pro Participant
    v_loot_per_resource := case v_outcome when 'victory' then v_sh.level * 500 else v_sh.level * 50 end;
    for p in select * from public.rally_participants where rally_id = r.id loop
      v_share := case when r.total_atk > 0 then p.atk_contribution::numeric / r.total_atk::numeric else 0 end;
      -- Truppen: 50% der "Verlorenen" sind verwundet → kommen zurück; 50% echter Verlust
      for v_key, v_count_committed in select * from jsonb_each_text(p.troops) loop
        v_lost := round(v_count_committed::int * v_loss_pct * 0.5);
        v_kept := v_count_committed::int - v_lost;
        if v_kept > 0 then
          insert into public.user_troops (user_id, troop_id, count) values (p.user_id, v_key, v_kept)
          on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
        end if;
      end loop;
      -- Loot: Resourcen je Participant × Share
      if v_outcome = 'victory' or v_outcome = 'defeat' then
        update public.user_resources set
          wood  = wood  + round(v_loot_per_resource * v_share),
          stone = stone + round(v_loot_per_resource * v_share),
          gold  = gold  + round(v_loot_per_resource * v_share),
          mana  = mana  + round(v_loot_per_resource * v_share / 2),
          guardian_xp = coalesce(guardian_xp, 0) + round(v_sh.level * 10 * v_share),
          updated_at = now()
         where user_id = p.user_id;
      end if;
      -- Bei Victory + Stronghold Lvl 8+: Chance auf Gold-Truhe
      if v_outcome = 'victory' and v_sh.level >= 8 and random() < 0.5 then
        insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
        values (p.user_id, 'gold', 'stronghold', now() + interval '24 hours');
      elsif v_outcome = 'victory' and v_sh.level >= 5 and random() < 0.6 then
        insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
        values (p.user_id, 'silver', 'stronghold', now() + interval '24 hours');
      end if;
    end loop;

    update public.rallies set
      status = 'done', outcome = v_outcome, resolved_at = now(),
      total_hp_dealt = least(v_total_atk, v_total_hp),
      loot = jsonb_build_object(
        'per_resource', v_loot_per_resource,
        'level', v_sh.level,
        'stronghold_killed', v_outcome = 'victory'
      )
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
revoke all on function public.resolve_due_rallies() from public;
grant execute on function public.resolve_due_rallies() to authenticated;

-- ─── 7) Read-RPC: get_active_rally_for_crew() ────────────────────────────
create or replace function public.get_active_rally_for_user()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_rally record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  perform public.resolve_due_rallies();
  select crew_id into v_crew from public.crew_members where user_id = v_user;
  if v_crew is null then return jsonb_build_object('ok', true, 'rally', null); end if;
  select * into v_rally from public.rallies
   where crew_id = v_crew and status in ('preparing','marching','fighting')
   order by created_at desc limit 1;
  if v_rally is null then return jsonb_build_object('ok', true, 'rally', null); end if;
  return jsonb_build_object('ok', true,
    'rally', jsonb_build_object(
      'id', v_rally.id,
      'leader_user_id', v_rally.leader_user_id,
      'crew_id', v_rally.crew_id,
      'stronghold_id', v_rally.stronghold_id,
      'prep_ends_at', v_rally.prep_ends_at,
      'march_ends_at', v_rally.march_ends_at,
      'status', v_rally.status,
      'total_atk', v_rally.total_atk
    ),
    'i_joined', exists (select 1 from public.rally_participants where rally_id = v_rally.id and user_id = v_user),
    'participants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'guardian_id', guardian_id,
        'troops', troops, 'atk_contribution', atk_contribution
      )), '[]'::jsonb) from public.rally_participants where rally_id = v_rally.id
    ),
    'stronghold', (
      select jsonb_build_object('id', id, 'lat', lat, 'lng', lng, 'level', level, 'total_hp', total_hp, 'current_hp', current_hp)
      from public.strongholds where id = v_rally.stronghold_id
    ));
end $$;
revoke all on function public.get_active_rally_for_user() from public;
grant execute on function public.get_active_rally_for_user() to authenticated;
