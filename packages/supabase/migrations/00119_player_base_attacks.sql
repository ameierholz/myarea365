-- ════════════════════════════════════════════════════════════════════
-- PLAYER-vs-PLAYER BASE-ANGRIFFS-SYSTEM (Demo + RPCs + Inbox-Reports)
-- ════════════════════════════════════════════════════════════════════
-- Analog zu resolve_base_attack (Crew, 00091), aber für Solo-Player-
-- Bases (public.bases). Inkl. Demo-Gegner "Schwarzer Eber" am
-- Senftenberger Ring 50 + 300 k Truppen für Kaelthor Malven.
-- ════════════════════════════════════════════════════════════════════

-- ─── 0) Hotfix: link_pending_team_invites referenziert NEW.email auf
--           public.users, dort gibt es aber keine email-Spalte. Wir
--           lookup'en die Email aus auth.users per id.
create or replace function public.link_pending_team_invites()
returns trigger language plpgsql security definer as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = new.id;
  if v_email is null then return new; end if;
  update public.shop_team_members
     set user_id = new.id, accepted_at = coalesce(accepted_at, now())
   where email = v_email and user_id is null;
  return new;
end $$;

-- ─── 1) Demo-Gegner-User + Base + Verteidigungs-Truppen ───────────────
do $$
declare
  v_uid uuid := '00000000-1111-2222-3333-444444444444'::uuid;
begin
  -- auth.users (idempotent)
  if not exists (select 1 from auth.users where id = v_uid) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid, v_uid,
      'authenticated', 'authenticated', 'demo-enemy@myarea365.local',
      crypt('disabled-demo-account', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Schwarzer Eber (Demo)"}'::jsonb,
      false, false
    );
  end if;

  -- public.users (Trigger fängt das normalerweise — hier safety-net)
  insert into public.users (id, username, display_name, level)
  values (v_uid, 'demo_enemy_eber', 'Schwarzer Eber (Demo)', 25)
  on conflict (id) do update set
    display_name = excluded.display_name,
    level = greatest(public.users.level, excluded.level);

  -- Demo-Base am Senftenberger Ring 50 (13435 Berlin Märkisches Viertel)
  insert into public.bases (
    owner_user_id, plz, level, lat, lng, visibility, theme_id, pin_label
  ) values (
    v_uid, '13435', 20, 52.5996, 13.3550, 'public', 'volcanic_forge', 'Schwarzer Eber'
  )
  on conflict (owner_user_id) do update set
    lat = excluded.lat, lng = excluded.lng,
    plz = excluded.plz,
    level = excluded.level, pin_label = excluded.pin_label,
    theme_id = excluded.theme_id, visibility = 'public';

  -- Verteidigungs-Truppen: 5 000 jedes T1-T3-Typs
  insert into public.user_troops (user_id, troop_id, count)
  select v_uid, t.id, 5000
    from public.troops_catalog t
   where t.tier <= 3
  on conflict (user_id, troop_id) do update set count = excluded.count;

  -- Ressourcen für Loot-Tests
  insert into public.user_resources (user_id, wood, stone, gold, mana)
  values (v_uid, 50000, 50000, 20000, 10000)
  on conflict (user_id) do update set
    wood = greatest(public.user_resources.wood, excluded.wood),
    stone = greatest(public.user_resources.stone, excluded.stone),
    gold = greatest(public.user_resources.gold, excluded.gold),
    mana = greatest(public.user_resources.mana, excluded.mana);
end $$;

-- ─── 2) Kaelthor Malven: 300 000 Truppen jeder Klasse ─────────────────
insert into public.user_troops (user_id, troop_id, count)
select u.id, t.id, 300000
  from public.users u
 cross join public.troops_catalog t
 where u.display_name ilike 'Kaelthor Malven'
on conflict (user_id, troop_id) do update set count = 300000;

-- ─── 3) player_base_attacks Tabelle ────────────────────────────────────
create table if not exists public.player_base_attacks (
  id uuid primary key default gen_random_uuid(),
  attacker_user_id uuid not null references public.users(id) on delete cascade,
  defender_user_id uuid not null references public.users(id) on delete cascade,
  attacker_lat double precision not null,
  attacker_lng double precision not null,
  defender_lat double precision not null,
  defender_lng double precision not null,
  troops_committed jsonb not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  resolved_at timestamptz,
  outcome text,
  loot jsonb,
  losses_attacker jsonb,
  losses_defender jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_pba_attacker on public.player_base_attacks (attacker_user_id, ends_at desc);
create index if not exists ix_pba_defender on public.player_base_attacks (defender_user_id, ends_at desc);
create index if not exists ix_pba_due on public.player_base_attacks (ends_at) where resolved_at is null;

alter table public.player_base_attacks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_base_attacks' and policyname='pba_read_own') then
    create policy pba_read_own on public.player_base_attacks
      for select using (auth.uid() = attacker_user_id or auth.uid() = defender_user_id);
  end if;
end $$;

-- ─── 4) attack_player_base(p_defender_user_id, p_troops jsonb) ─────────
create or replace function public.attack_player_base(
  p_defender_user_id uuid,
  p_troops jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_attacker_base record;
  v_defender_base record;
  v_distance_m numeric;
  v_march_seconds int;
  v_total_troops int := 0;
  v_avail int;
  v_attack_id uuid;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_attack_self'); end if;

  select * into v_attacker_base from public.bases where owner_user_id = v_user;
  if v_attacker_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;

  select * into v_defender_base from public.bases where owner_user_id = p_defender_user_id;
  if v_defender_base is null then return jsonb_build_object('ok', false, 'error', 'defender_no_base'); end if;

  if v_defender_base.shield_until is not null and v_defender_base.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'defender_shielded', 'shield_until', v_defender_base.shield_until);
  end if;

  -- bereits laufender Angriff dieses Spielers?
  if exists (
    select 1 from public.player_base_attacks
     where attacker_user_id = v_user and resolved_at is null and ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'error', 'march_already_active');
  end if;

  -- Haversine-Distanz in Metern
  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((v_defender_base.lat - v_attacker_base.lat) / 2)), 2) +
    cos(radians(v_attacker_base.lat)) * cos(radians(v_defender_base.lat)) *
    power(sin(radians((v_defender_base.lng - v_attacker_base.lng) / 2)), 2)
  ));

  -- Marsch: 50 m/s, min 60 s, max 30 min
  v_march_seconds := greatest(60, least(1800, ceil(v_distance_m / 50)::int));

  -- Truppen-Validierung
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    select count into v_avail from public.user_troops where user_id = v_user and troop_id = k;
    if v_avail is null or v_avail < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops',
        'troop_id', k, 'have', coalesce(v_avail, 0), 'need', v_cnt::int);
    end if;
    v_total_troops := v_total_troops + v_cnt::int;
  end loop;

  if v_total_troops < 10 then
    return jsonb_build_object('ok', false, 'error', 'min_troops_10');
  end if;

  -- Truppen abziehen (committed)
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_cnt::int
      where user_id = v_user and troop_id = k;
  end loop;

  insert into public.player_base_attacks (
    attacker_user_id, defender_user_id,
    attacker_lat, attacker_lng, defender_lat, defender_lng,
    troops_committed, ends_at
  ) values (
    v_user, p_defender_user_id,
    v_attacker_base.lat, v_attacker_base.lng,
    v_defender_base.lat, v_defender_base.lng,
    p_troops, now() + (v_march_seconds || ' seconds')::interval
  ) returning id into v_attack_id;

  return jsonb_build_object(
    'ok', true,
    'attack_id', v_attack_id,
    'march_seconds', v_march_seconds,
    'distance_m', round(v_distance_m)::int,
    'ends_at', (now() + (v_march_seconds || ' seconds')::interval)
  );
end $$;

revoke all on function public.attack_player_base(uuid, jsonb) from public;
grant execute on function public.attack_player_base(uuid, jsonb) to authenticated;

-- ─── 5) resolve_player_base_attack(p_attack_id) ────────────────────────
create or replace function public.resolve_player_base_attack(p_attack_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  a record;
  v_atk_power int := 0;
  v_def_power int := 0;
  v_def_base record;
  v_hp_before int := 0;
  v_hp_after int := 0;
  v_dmg int := 0;
  v_outcome text;
  v_loot_pct numeric := 0;
  v_loss_pct_atk numeric := 0;
  v_loss_pct_def numeric := 0;
  v_loot_w int := 0; v_loot_s int := 0;
  v_loot_g int := 0; v_loot_m int := 0;
  v_pillage boolean := false;
  k text; v_cnt int;
  v_t record;
  v_atk_name text; v_def_name text;
  v_lost int; v_kept int;
begin
  select * into a from public.player_base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;

  -- Attacker-Power
  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    select * into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;
    v_atk_power := v_atk_power + v_t.base_atk * v_cnt::int;
  end loop;

  -- Defender-Power (alle stationären Truppen × base_def)
  select coalesce(sum(ut.count * t.base_def), 0)::int
    into v_def_power
    from public.user_troops ut
    join public.troops_catalog t on t.id = ut.troop_id
   where ut.user_id = a.defender_user_id;

  -- Wall-Bonus + HP-Refresh
  select * into v_def_base from public.bases where owner_user_id = a.defender_user_id;
  if v_def_base is not null then
    v_def_power := round(v_def_power * (1 + v_def_base.level * 0.03));
    perform public.refresh_base_hp(v_def_base.id, false);
    select current_hp into v_hp_before from public.bases where id = v_def_base.id;
  end if;

  v_dmg := greatest(round(v_atk_power * 0.6)::int, v_atk_power - v_def_power);
  if v_atk_power > 0 then v_dmg := greatest(200, v_dmg); end if;

  if v_def_base is not null then
    v_hp_after := greatest(0, v_hp_before - v_dmg);
    update public.bases set current_hp = v_hp_after, hp_updated_at = now()
      where id = v_def_base.id;
  end if;

  if v_def_base is not null and v_hp_after = 0 then
    v_outcome := 'attacker_pillaged'; v_pillage := true;
    v_loot_pct := 0.30; v_loss_pct_atk := 0.20; v_loss_pct_def := 0.45;
  elsif v_atk_power > v_def_power * 1.10 then
    v_outcome := 'attacker_won';
    v_loot_pct := 0.10; v_loss_pct_atk := 0.25; v_loss_pct_def := 0.30;
  elsif v_def_power > v_atk_power * 1.10 then
    v_outcome := 'defender_won';
    v_loot_pct := 0; v_loss_pct_atk := 0.65; v_loss_pct_def := 0.10;
  else
    v_outcome := 'draw';
    v_loot_pct := 0; v_loss_pct_atk := 0.40; v_loss_pct_def := 0.30;
  end if;

  -- Loot Defender → Attacker
  if v_loot_pct > 0 then
    select greatest(0, round(coalesce(wood,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(stone,0) * v_loot_pct)::int),
           greatest(0, round(coalesce(gold,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(mana,0)  * v_loot_pct)::int)
      into v_loot_w, v_loot_s, v_loot_g, v_loot_m
      from public.user_resources where user_id = a.defender_user_id;
    update public.user_resources set
       wood  = greatest(0, wood  - v_loot_w),
       stone = greatest(0, stone - v_loot_s),
       gold  = greatest(0, gold  - v_loot_g),
       mana  = greatest(0, mana  - v_loot_m),
       updated_at = now()
     where user_id = a.defender_user_id;
    insert into public.user_resources (user_id, wood, stone, gold, mana)
    values (a.attacker_user_id, v_loot_w, v_loot_s, v_loot_g, v_loot_m)
    on conflict (user_id) do update set
       wood  = public.user_resources.wood  + excluded.wood,
       stone = public.user_resources.stone + excluded.stone,
       gold  = public.user_resources.gold  + excluded.gold,
       mana  = public.user_resources.mana  + excluded.mana,
       updated_at = now();
  end if;

  -- Survivor-Truppen zurück (50 % der Verluste verwundet, kommen wieder)
  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    if v_cnt::int <= 0 then continue; end if;
    v_lost := round(v_cnt::int * v_loss_pct_atk * 0.5)::int;
    v_kept := v_cnt::int - v_lost;
    if v_kept > 0 then
      insert into public.user_troops (user_id, troop_id, count)
      values (a.attacker_user_id, k, v_kept)
      on conflict (user_id, troop_id) do update set
        count = public.user_troops.count + excluded.count;
    end if;
  end loop;

  -- Defender-Verluste (vereinfacht: anteilig auf alle stationären Stacks)
  if v_loss_pct_def > 0 then
    update public.user_troops
       set count = greatest(0, round(count * (1 - v_loss_pct_def * 0.5))::int)
     where user_id = a.defender_user_id;
  end if;

  update public.player_base_attacks set
    resolved_at = now(),
    outcome = v_outcome,
    loot = jsonb_build_object(
      'wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m,
      'pillage', v_pillage, 'hp_damage', v_dmg,
      'hp_before', v_hp_before, 'hp_after', v_hp_after),
    losses_attacker = jsonb_build_object('total_atk', v_atk_power, 'pct_lost', round(v_loss_pct_atk * 100)::int),
    losses_defender = jsonb_build_object('total_def', v_def_power, 'pct_lost', round(v_loss_pct_def * 100)::int)
   where id = p_attack_id;

  -- Inbox-Reports
  select coalesce(display_name, username, 'Unbekannt') into v_atk_name
    from public.users where id = a.attacker_user_id;
  select coalesce(display_name, username, 'Unbekannt') into v_def_name
    from public.users where id = a.defender_user_id;

  insert into public.user_inbox (user_id, title, body) values
  (a.attacker_user_id,
   '⚔️ Schlachtbericht: Angriff auf ' || v_def_name,
   'Ergebnis: ' || case v_outcome
       when 'attacker_pillaged' then '🏆 Plünderung erfolgreich!'
       when 'attacker_won' then '✅ Sieg!'
       when 'defender_won' then '❌ Niederlage'
       else '⚖️ Unentschieden' end
   || E'\n\nDeine Angriffsstärke: ' || v_atk_power
   || E'\nGegnerische Verteidigung: ' || v_def_power
   || E'\nBase-HP-Schaden: ' || v_dmg || ' (' || v_hp_before || ' → ' || v_hp_after || ')'
   || E'\nDeine Verluste: ~' || round(v_loss_pct_atk * 100)::int || '%'
   || E'\n\nBeute:'
   || E'\n  🌲 Holz: '  || v_loot_w
   || E'\n  🪨 Stein: ' || v_loot_s
   || E'\n  🪙 Gold: '  || v_loot_g
   || E'\n  💧 Mana: '  || v_loot_m),
  (a.defender_user_id,
   '🛡️ Schlachtbericht: Angriff von ' || v_atk_name,
   'Ergebnis: ' || case v_outcome
       when 'attacker_pillaged' then '💀 Deine Base wurde geplündert!'
       when 'attacker_won' then '⚠️ Verteidigung gefallen'
       when 'defender_won' then '🛡️ Erfolgreich verteidigt!'
       else '⚖️ Unentschieden' end
   || E'\n\nGegnerische Angriffsstärke: ' || v_atk_power
   || E'\nDeine Verteidigung: ' || v_def_power
   || E'\nBase-HP-Schaden: ' || v_dmg || ' (' || v_hp_before || ' → ' || v_hp_after || ')'
   || E'\nDeine Verluste: ~' || round(v_loss_pct_def * 100)::int || '%'
   || E'\n\nGeplündert:'
   || E'\n  🌲 ' || v_loot_w || ' Holz'
   || E'\n  🪨 ' || v_loot_s || ' Stein'
   || E'\n  🪙 ' || v_loot_g || ' Gold'
   || E'\n  💧 ' || v_loot_m || ' Mana');

  return jsonb_build_object('ok', true, 'outcome', v_outcome,
    'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m));
end $$;

revoke all on function public.resolve_player_base_attack(uuid) from public;
grant execute on function public.resolve_player_base_attack(uuid) to authenticated;

-- ─── 6) Cron: resolve_due_player_base_attacks() ────────────────────────
create or replace function public.resolve_due_player_base_attacks()
returns int language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.player_base_attacks
     where resolved_at is null and ends_at <= now()
     order by ends_at
     limit 100
  loop
    perform public.resolve_player_base_attack(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.resolve_due_player_base_attacks() from public;
grant execute on function public.resolve_due_player_base_attacks() to authenticated;
