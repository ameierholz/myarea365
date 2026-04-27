-- ════════════════════════════════════════════════════════════════════
-- PLAYER-BASE-RALLY ("Versammeln") — Crew-Aufgebot gegen Spieler-Base
-- ════════════════════════════════════════════════════════════════════
-- Analog zu 00110_rallies (Wegelager), aber Ziel = fremde Player-Base.
-- Crew-Leader öffnet Rally → Crew-Mitglieder können in der Prep-Phase
-- beitreten. Wenn Prep abläuft: Marsch zur Defender-Base, Combat,
-- HP-Schaden, Loot, Survivor-Truppen zurück, Inbox-Reports für alle.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) player_base_rallies ───────────────────────────────────────────
create table if not exists public.player_base_rallies (
  id                uuid primary key default gen_random_uuid(),
  leader_user_id    uuid not null references public.users(id) on delete cascade,
  crew_id           uuid not null references public.crews(id) on delete cascade,
  defender_user_id  uuid not null references public.users(id) on delete cascade,
  defender_lat      double precision not null,
  defender_lng      double precision not null,
  prep_seconds      int  not null check (prep_seconds in (180, 480, 1680)), -- 3 / 8 / 28 min
  prep_ends_at      timestamptz not null,
  march_ends_at     timestamptz,
  status            text not null default 'preparing'
                    check (status in ('preparing','marching','fighting','done','aborted')),
  outcome           text check (outcome in ('attacker_pillaged','attacker_won','defender_won','draw','aborted')),
  total_atk         bigint default 0,
  loot              jsonb,
  losses_attacker   jsonb,
  losses_defender   jsonb,
  hp_before         int,
  hp_after          int,
  hp_damage         int,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists idx_pbr_crew      on public.player_base_rallies(crew_id, status);
create index if not exists idx_pbr_open      on public.player_base_rallies(prep_ends_at) where status = 'preparing';
create index if not exists idx_pbr_marching  on public.player_base_rallies(march_ends_at) where status = 'marching';
create index if not exists idx_pbr_defender  on public.player_base_rallies(defender_user_id, status);

alter table public.player_base_rallies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_base_rallies' and policyname='pbr_select_member_or_defender') then
    create policy pbr_select_member_or_defender on public.player_base_rallies for select using (
      defender_user_id = auth.uid() or exists (
        select 1 from public.crew_members cm
         where cm.crew_id = player_base_rallies.crew_id and cm.user_id = auth.uid()
      )
    );
  end if;
end $$;

-- ─── 2) player_base_rally_participants ────────────────────────────────
create table if not exists public.player_base_rally_participants (
  rally_id        uuid not null references public.player_base_rallies(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  troops          jsonb not null default '{}'::jsonb,
  atk_contribution bigint default 0,
  joined_at       timestamptz not null default now(),
  primary key (rally_id, user_id)
);
create index if not exists idx_pbrp_user on public.player_base_rally_participants(user_id);

alter table public.player_base_rally_participants enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_base_rally_participants' and policyname='pbrp_select') then
    create policy pbrp_select on public.player_base_rally_participants for select using (
      user_id = auth.uid() or exists (
        select 1 from public.player_base_rallies r
        join public.crew_members cm on cm.crew_id = r.crew_id
        where r.id = player_base_rally_participants.rally_id and cm.user_id = auth.uid()
      )
    );
  end if;
end $$;

-- ─── 3) start_player_base_rally ───────────────────────────────────────
create or replace function public.start_player_base_rally(
  p_defender_user_id uuid,
  p_prep_seconds     int,
  p_troops           jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user        uuid := auth.uid();
  v_crew        uuid;
  v_def_base    record;
  v_atk         bigint;
  v_rally_id    uuid;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_attack_self'); end if;

  -- Crew-Mitgliedschaft + ggf. Leader-Rolle
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  -- Defender-Base
  select * into v_def_base from public.bases where owner_user_id = p_defender_user_id;
  if v_def_base is null then return jsonb_build_object('ok', false, 'error', 'defender_no_base'); end if;
  if v_def_base.shield_until is not null and v_def_base.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'defender_shielded');
  end if;

  -- bereits laufender Rally dieser Crew gegen Bases?
  if exists (
    select 1 from public.player_base_rallies
     where crew_id = v_crew and status in ('preparing','marching','fighting')
  ) then
    return jsonb_build_object('ok', false, 'error', 'crew_rally_already_active');
  end if;

  -- Truppen sperren (raises bei not_enough_troops)
  begin
    v_atk := public._reserve_user_troops(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  insert into public.player_base_rallies (
    leader_user_id, crew_id, defender_user_id,
    defender_lat, defender_lng,
    prep_seconds, prep_ends_at, total_atk
  ) values (
    v_user, v_crew, p_defender_user_id,
    v_def_base.lat, v_def_base.lng,
    p_prep_seconds, now() + (p_prep_seconds || ' seconds')::interval, v_atk
  ) returning id into v_rally_id;

  insert into public.player_base_rally_participants (rally_id, user_id, troops, atk_contribution)
  values (v_rally_id, v_user, p_troops, v_atk);

  return jsonb_build_object('ok', true, 'rally_id', v_rally_id,
    'prep_ends_at', (now() + (p_prep_seconds || ' seconds')::interval),
    'atk', v_atk);
end $$;
revoke all on function public.start_player_base_rally(uuid, int, jsonb) from public;
grant execute on function public.start_player_base_rally(uuid, int, jsonb) to authenticated;

-- ─── 4) join_player_base_rally ────────────────────────────────────────
create or replace function public.join_player_base_rally(
  p_rally_id uuid,
  p_troops   jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r      record;
  v_atk  bigint;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into r from public.player_base_rallies where id = p_rally_id for update;
  if r is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'not_in_prep'); end if;
  if r.prep_ends_at <= now() then return jsonb_build_object('ok', false, 'error', 'prep_ended'); end if;

  -- selbe Crew?
  if not exists (select 1 from public.crew_members where crew_id = r.crew_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'wrong_crew');
  end if;

  -- bereits beigetreten?
  if exists (select 1 from public.player_base_rally_participants where rally_id = p_rally_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;

  begin
    v_atk := public._reserve_user_troops(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  insert into public.player_base_rally_participants (rally_id, user_id, troops, atk_contribution)
  values (p_rally_id, v_user, p_troops, v_atk);

  update public.player_base_rallies set total_atk = total_atk + v_atk where id = p_rally_id;

  return jsonb_build_object('ok', true, 'atk', v_atk);
end $$;
revoke all on function public.join_player_base_rally(uuid, jsonb) from public;
grant execute on function public.join_player_base_rally(uuid, jsonb) to authenticated;

-- ─── 5) cancel_player_base_rally (Leader, nur in Prep) ────────────────
create or replace function public.cancel_player_base_rally(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  p record;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into r from public.player_base_rallies where id = p_rally_id for update;
  if r is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.leader_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_leader'); end if;
  if r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'not_in_prep'); end if;

  -- Truppen aller Teilnehmer zurückgeben
  for p in select * from public.player_base_rally_participants where rally_id = p_rally_id loop
    for k, v_cnt in select * from jsonb_each_text(p.troops) loop
      if v_cnt::int <= 0 then continue; end if;
      insert into public.user_troops (user_id, troop_id, count)
      values (p.user_id, k, v_cnt::int)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
    end loop;
  end loop;

  update public.player_base_rallies set status = 'aborted', outcome = 'aborted', resolved_at = now()
   where id = p_rally_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.cancel_player_base_rally(uuid) from public;
grant execute on function public.cancel_player_base_rally(uuid) to authenticated;

-- ─── 6) resolve_player_base_rally (Cron) ──────────────────────────────
create or replace function public.resolve_player_base_rally(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  r record;
  v_def_base record;
  v_def_power int := 0;
  v_atk_power bigint := 0;
  v_dmg int := 0;
  v_hp_before int := 0;
  v_hp_after  int := 0;
  v_outcome text;
  v_loot_pct numeric := 0;
  v_loss_pct_atk numeric := 0;
  v_loss_pct_def numeric := 0;
  v_loot_w int := 0; v_loot_s int := 0; v_loot_g int := 0; v_loot_m int := 0;
  v_pillage boolean := false;
  v_def_name text;
  v_leader_name text;
  p record;
  k text; v_cnt int;
  v_share numeric;
  v_lost int; v_kept int;
  v_p_loot_w int; v_p_loot_s int; v_p_loot_g int; v_p_loot_m int;
begin
  select * into r from public.player_base_rallies where id = p_rally_id for update;
  if r is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status not in ('preparing','marching') then
    return jsonb_build_object('ok', false, 'error', 'wrong_status');
  end if;

  -- Phasen-Übergang Prep → Marching
  if r.status = 'preparing' then
    if r.prep_ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
    update public.player_base_rallies
       set status = 'marching',
           march_ends_at = now() + interval '60 seconds'  -- pauschaler 60s Marsch
     where id = p_rally_id;
    return jsonb_build_object('ok', true, 'phase', 'marching');
  end if;

  -- Marching → Combat: nur wenn march_ends_at vorbei
  if r.march_ends_at is null or r.march_ends_at > now() then
    return jsonb_build_object('ok', false, 'error', 'still_marching');
  end if;

  v_atk_power := r.total_atk;

  select * into v_def_base from public.bases where owner_user_id = r.defender_user_id;
  if v_def_base is not null then
    select coalesce(sum(ut.count * t.base_def), 0)::int into v_def_power
      from public.user_troops ut join public.troops_catalog t on t.id = ut.troop_id
     where ut.user_id = r.defender_user_id;
    v_def_power := round(v_def_power * (1 + v_def_base.level * 0.03));
    perform public.refresh_base_hp(v_def_base.id, false);
    select current_hp into v_hp_before from public.bases where id = v_def_base.id;
  end if;

  v_dmg := greatest(round(v_atk_power * 0.6)::int, (v_atk_power - v_def_power)::int);
  if v_atk_power > 0 then v_dmg := greatest(200, v_dmg); end if;

  if v_def_base is not null then
    v_hp_after := greatest(0, v_hp_before - v_dmg);
    update public.bases set current_hp = v_hp_after, hp_updated_at = now() where id = v_def_base.id;
  end if;

  if v_def_base is not null and v_hp_after = 0 then
    v_outcome := 'attacker_pillaged'; v_pillage := true;
    v_loot_pct := 0.40; v_loss_pct_atk := 0.20; v_loss_pct_def := 0.50;
  elsif v_atk_power > v_def_power * 1.10 then
    v_outcome := 'attacker_won';
    v_loot_pct := 0.15; v_loss_pct_atk := 0.25; v_loss_pct_def := 0.35;
  elsif v_def_power > v_atk_power * 1.10 then
    v_outcome := 'defender_won';
    v_loot_pct := 0; v_loss_pct_atk := 0.65; v_loss_pct_def := 0.10;
  else
    v_outcome := 'draw';
    v_loot_pct := 0; v_loss_pct_atk := 0.40; v_loss_pct_def := 0.30;
  end if;

  -- Loot vom Defender
  if v_loot_pct > 0 then
    select greatest(0, round(coalesce(wood,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(stone,0) * v_loot_pct)::int),
           greatest(0, round(coalesce(gold,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(mana,0)  * v_loot_pct)::int)
      into v_loot_w, v_loot_s, v_loot_g, v_loot_m
      from public.user_resources where user_id = r.defender_user_id;
    update public.user_resources set
       wood  = greatest(0, wood  - v_loot_w),
       stone = greatest(0, stone - v_loot_s),
       gold  = greatest(0, gold  - v_loot_g),
       mana  = greatest(0, mana  - v_loot_m),
       updated_at = now()
     where user_id = r.defender_user_id;
  end if;

  -- Defender-Verluste
  if v_loss_pct_def > 0 then
    update public.user_troops
       set count = greatest(0, round(count * (1 - v_loss_pct_def * 0.5))::int)
     where user_id = r.defender_user_id;
  end if;

  select coalesce(display_name, username, 'Verteidiger') into v_def_name
    from public.users where id = r.defender_user_id;
  select coalesce(display_name, username, 'Anführer') into v_leader_name
    from public.users where id = r.leader_user_id;

  -- Per-Participant: Survivor-Truppen + anteiliger Loot + Inbox
  for p in select * from public.player_base_rally_participants where rally_id = p_rally_id loop
    v_share := case when v_atk_power > 0 then p.atk_contribution::numeric / v_atk_power::numeric else 0 end;

    -- Survivor zurück
    for k, v_cnt in select * from jsonb_each_text(p.troops) loop
      if v_cnt::int <= 0 then continue; end if;
      v_lost := round(v_cnt::int * v_loss_pct_atk * 0.5)::int;
      v_kept := v_cnt::int - v_lost;
      if v_kept > 0 then
        insert into public.user_troops (user_id, troop_id, count)
        values (p.user_id, k, v_kept)
        on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
      end if;
    end loop;

    -- Loot anteilig
    v_p_loot_w := round(v_loot_w * v_share)::int;
    v_p_loot_s := round(v_loot_s * v_share)::int;
    v_p_loot_g := round(v_loot_g * v_share)::int;
    v_p_loot_m := round(v_loot_m * v_share)::int;
    if v_p_loot_w + v_p_loot_s + v_p_loot_g + v_p_loot_m > 0 then
      insert into public.user_resources (user_id, wood, stone, gold, mana)
      values (p.user_id, v_p_loot_w, v_p_loot_s, v_p_loot_g, v_p_loot_m)
      on conflict (user_id) do update set
        wood  = public.user_resources.wood  + excluded.wood,
        stone = public.user_resources.stone + excluded.stone,
        gold  = public.user_resources.gold  + excluded.gold,
        mana  = public.user_resources.mana  + excluded.mana,
        updated_at = now();
    end if;

    -- Inbox
    insert into public.user_inbox (user_id, title, body) values
    (p.user_id,
     '⚔️ Aufgebots-Bericht: Angriff auf ' || v_def_name,
     'Crew-Aufgebot von ' || v_leader_name || E'\n\nErgebnis: ' || case v_outcome
        when 'attacker_pillaged' then '🏆 Plünderung erfolgreich!'
        when 'attacker_won' then '✅ Sieg!'
        when 'defender_won' then '❌ Niederlage'
        else '⚖️ Unentschieden' end
     || E'\n\nGesamt-Angriff: ' || v_atk_power
     || E'\nVerteidigung: ' || v_def_power
     || E'\nBase-HP: ' || v_hp_before || ' → ' || v_hp_after || ' (-' || v_dmg || ')'
     || E'\n\nDein Beitrag: ' || p.atk_contribution || ' ATK ('
     || round(v_share * 100, 1) || '%)'
     || E'\nDeine Verluste: ~' || round(v_loss_pct_atk * 100)::int || '%'
     || E'\nDein Beute-Anteil:'
     || E'\n  🌲 ' || v_p_loot_w || E'  🪨 ' || v_p_loot_s
     || E'  🪙 ' || v_p_loot_g || E'  💧 ' || v_p_loot_m);
  end loop;

  -- Defender-Inbox
  insert into public.user_inbox (user_id, title, body) values
  (r.defender_user_id,
   '🛡️ Crew-Angriff: Aufgebot von ' || v_leader_name,
   E'Eine fremde Crew hat deine Base mit einem Aufgebot angegriffen.\n\nErgebnis: '
   || case v_outcome
      when 'attacker_pillaged' then '💀 Deine Base wurde geplündert!'
      when 'attacker_won' then '⚠️ Verteidigung gefallen'
      when 'defender_won' then '🛡️ Erfolgreich verteidigt!'
      else '⚖️ Unentschieden' end
   || E'\n\nGegnerische Angriffsmacht: ' || v_atk_power
   || E'\nDeine Verteidigung: ' || v_def_power
   || E'\nBase-HP-Schaden: ' || v_dmg || ' (' || v_hp_before || ' → ' || v_hp_after || ')'
   || E'\nDeine Truppen-Verluste: ~' || round(v_loss_pct_def * 100)::int || '%'
   || E'\n\nGeplündert: 🌲 ' || v_loot_w || E'  🪨 ' || v_loot_s
   || E'  🪙 ' || v_loot_g || E'  💧 ' || v_loot_m);

  update public.player_base_rallies set
    status = 'done',
    outcome = v_outcome,
    resolved_at = now(),
    hp_before = v_hp_before, hp_after = v_hp_after, hp_damage = v_dmg,
    loot = jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m, 'pillage', v_pillage),
    losses_attacker = jsonb_build_object('total_atk', v_atk_power, 'pct_lost', round(v_loss_pct_atk * 100)::int),
    losses_defender = jsonb_build_object('total_def', v_def_power, 'pct_lost', round(v_loss_pct_def * 100)::int)
   where id = p_rally_id;

  return jsonb_build_object('ok', true, 'outcome', v_outcome,
    'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after);
end $$;
revoke all on function public.resolve_player_base_rally(uuid) from public;
grant execute on function public.resolve_player_base_rally(uuid) to authenticated;

-- ─── 7) Cron-Tick: Phasen-Wechsel + Combat ────────────────────────────
create or replace function public.resolve_due_player_base_rallies()
returns int language plpgsql security definer as $$
declare r record; n int := 0;
begin
  -- preparing → marching
  for r in
    select id from public.player_base_rallies
     where status = 'preparing' and prep_ends_at <= now()
     order by prep_ends_at limit 100
  loop
    perform public.resolve_player_base_rally(r.id);
    n := n + 1;
  end loop;
  -- marching → done
  for r in
    select id from public.player_base_rallies
     where status = 'marching' and march_ends_at <= now()
     order by march_ends_at limit 100
  loop
    perform public.resolve_player_base_rally(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.resolve_due_player_base_rallies() from public;
grant execute on function public.resolve_due_player_base_rallies() to authenticated;

-- ─── 8) get_active_player_base_rally — für Banner ────────────────────
create or replace function public.get_active_player_base_rally()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  v_def_name text;
  v_leader_name text;
  v_joined boolean;
  v_participants int;
begin
  if v_user is null then return null; end if;

  select pbr.* into r
    from public.player_base_rallies pbr
    join public.crew_members cm on cm.crew_id = pbr.crew_id
   where cm.user_id = v_user
     and pbr.status in ('preparing','marching')
   order by pbr.created_at desc
   limit 1;

  if r is null then return null; end if;

  select coalesce(display_name, username, 'Verteidiger') into v_def_name
    from public.users where id = r.defender_user_id;
  select coalesce(display_name, username, 'Anführer') into v_leader_name
    from public.users where id = r.leader_user_id;

  v_joined := exists (
    select 1 from public.player_base_rally_participants
     where rally_id = r.id and user_id = v_user);

  select count(*) into v_participants
    from public.player_base_rally_participants where rally_id = r.id;

  return jsonb_build_object(
    'rally_id', r.id,
    'leader_name', v_leader_name,
    'is_leader', r.leader_user_id = v_user,
    'defender_name', v_def_name,
    'defender_user_id', r.defender_user_id,
    'defender_lat', r.defender_lat,
    'defender_lng', r.defender_lng,
    'status', r.status,
    'prep_ends_at', r.prep_ends_at,
    'march_ends_at', r.march_ends_at,
    'total_atk', r.total_atk,
    'participants', v_participants,
    'joined', v_joined
  );
end $$;
revoke all on function public.get_active_player_base_rally() from public;
grant execute on function public.get_active_player_base_rally() to authenticated;
