-- ════════════════════════════════════════════════════════════════════════
-- CREW Phase-4-Mechaniken aktivieren:
--   1) crew_treasury (geteilter Crew-Resource-Pool)
--   2) Schwarzmarkt: passive Income + Withdraw
--   3) Bunker: Verteidigungs-Begleiter Garrison + Counter-Attack-Hook
--   4) crew_repeater_attacks: Hook für War-Score + Bunker-Counter
--   5) Aktivitäts-Stats für Repeater-Modal (Angriffe heute / Reparatur heute)
--   6) War-RPCs: list_crew_wars, get_war_status
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Crew-Treasury (geteilter Resource-Pool) ─────────────────────────
create table if not exists public.crew_treasury (
  crew_id   uuid primary key references public.crews(id) on delete cascade,
  gold      bigint not null default 0,
  wood      bigint not null default 0,
  stone     bigint not null default 0,
  mana      bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.crew_treasury enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_treasury' and policyname='crew_treasury_read_member') then
    create policy crew_treasury_read_member on public.crew_treasury for select using (
      crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
    );
  end if;
end $$;

create table if not exists public.crew_treasury_log (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  source      text not null,                    -- 'blackmarket_income' | 'withdraw' | 'donation' | ...
  user_id     uuid references public.users(id) on delete set null,
  delta_gold  int not null default 0,
  delta_wood  int not null default 0,
  delta_stone int not null default 0,
  delta_mana  int not null default 0,
  ref_id      uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_crew_treasury_log_crew on public.crew_treasury_log(crew_id, created_at desc);

alter table public.crew_treasury_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_treasury_log' and policyname='crew_treasury_log_read_member') then
    create policy crew_treasury_log_read_member on public.crew_treasury_log for select using (
      crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
    );
  end if;
end $$;

create or replace function public._crew_treasury_apply(
  p_crew uuid, p_source text, p_user uuid,
  p_gold int, p_wood int, p_stone int, p_mana int,
  p_ref uuid default null
) returns void language plpgsql security definer as $$
begin
  insert into public.crew_treasury (crew_id, gold, wood, stone, mana, updated_at)
       values (p_crew, greatest(0, p_gold), greatest(0, p_wood), greatest(0, p_stone), greatest(0, p_mana), now())
  on conflict (crew_id) do update set
    gold  = greatest(0, public.crew_treasury.gold  + excluded.gold),
    wood  = greatest(0, public.crew_treasury.wood  + excluded.wood),
    stone = greatest(0, public.crew_treasury.stone + excluded.stone),
    mana  = greatest(0, public.crew_treasury.mana  + excluded.mana),
    updated_at = now();
  insert into public.crew_treasury_log
    (crew_id, source, user_id, delta_gold, delta_wood, delta_stone, delta_mana, ref_id)
  values
    (p_crew, p_source, p_user, p_gold, p_wood, p_stone, p_mana, p_ref);
end $$;

-- ─── 2a) Schwarzmarkt: passive Income via Cron-Tick ─────────────────────
-- Konzept: jeder aktive Schwarzmarkt der Crew generiert pro Stunde basierend
-- auf der Anzahl Crew-Member × Level Income. Income geht in crew_treasury.
-- Letzter Tick wird in kind_data.last_tick_at gespeichert; max 24h-Backlog.
create or replace function public.tick_blackmarket_income()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  bm record;
  v_member_count int;
  v_last_tick timestamptz;
  v_hours numeric;
  v_gold int; v_wood int; v_stone int; v_mana int;
  v_per_hour_per_member int;
begin
  for bm in
    select b.id, b.crew_id, b.level, b.kind_data, b.hp, b.max_hp
      from public.crew_buildings b
     where b.kind = 'blackmarket'
       and b.destroyed_at is null
       and b.hp > 0
     for update
  loop
    -- Last-Tick aus kind_data, default = created_at (über separate Query)
    v_last_tick := nullif(bm.kind_data->>'last_tick_at', '')::timestamptz;
    if v_last_tick is null then
      select created_at into v_last_tick from public.crew_buildings where id = bm.id;
    end if;
    -- Backlog cappen auf 24h damit niemand wochenlang NICHT abruft und dann floodet
    if v_last_tick < now() - interval '24 hours' then
      v_last_tick := now() - interval '24 hours';
    end if;
    v_hours := extract(epoch from (now() - v_last_tick)) / 3600.0;
    if v_hours < 0.05 then  -- weniger als 3 Min seit Tick → skip
      continue;
    end if;

    select count(*) into v_member_count from public.crew_members where crew_id = bm.crew_id;
    if v_member_count = 0 then
      update public.crew_buildings
         set kind_data = kind_data || jsonb_build_object('last_tick_at', now())
       where id = bm.id;
      continue;
    end if;

    -- Pro Stunde pro Member Income (skaliert mit Level: 50 + level*25)
    v_per_hour_per_member := 50 + bm.level * 25;
    -- HP-Faktor: bei <30% HP nur halber Income (zerstört wäre 0, aber WHERE filtert das schon)
    if bm.hp::numeric / nullif(bm.max_hp, 0) < 0.30 then
      v_per_hour_per_member := (v_per_hour_per_member * 0.5)::int;
    end if;

    v_gold  := (v_per_hour_per_member * v_member_count * v_hours)::int;
    v_wood  := (v_per_hour_per_member * 0.6 * v_member_count * v_hours)::int;
    v_stone := (v_per_hour_per_member * 0.6 * v_member_count * v_hours)::int;
    v_mana  := (v_per_hour_per_member * 0.2 * v_member_count * v_hours)::int;

    if v_gold + v_wood + v_stone + v_mana > 0 then
      perform public._crew_treasury_apply(
        bm.crew_id, 'blackmarket_income', null,
        v_gold, v_wood, v_stone, v_mana, bm.id
      );
    end if;

    update public.crew_buildings
       set kind_data = kind_data
         || jsonb_build_object('last_tick_at', now())
         || jsonb_build_object('last_income', jsonb_build_object(
              'gold', v_gold, 'wood', v_wood, 'stone', v_stone, 'mana', v_mana,
              'hours', round(v_hours::numeric, 2), 'members', v_member_count
            ))
     where id = bm.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.tick_blackmarket_income() to authenticated, service_role;

-- ─── 2b) Schwarzmarkt: get_blackmarket_status ───────────────────────────
create or replace function public.get_blackmarket_status(p_building_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_user uuid := auth.uid();
  v_b record;
  v_treasury record;
  v_member_count int;
  v_per_hour_per_member int;
  v_per_hour_total_gold int;
  v_log_24h jsonb;
begin
  select id, crew_id, level, kind_data, hp, max_hp, created_at
    into v_b
    from public.crew_buildings
   where id = p_building_id and kind = 'blackmarket' and destroyed_at is null;
  if v_b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- Mitgliedschaft prüfen
  if not exists (select 1 from public.crew_members where user_id = v_user and crew_id = v_b.crew_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  select gold, wood, stone, mana into v_treasury from public.crew_treasury where crew_id = v_b.crew_id;
  select count(*) into v_member_count from public.crew_members where crew_id = v_b.crew_id;

  v_per_hour_per_member := 50 + v_b.level * 25;
  if v_b.hp::numeric / nullif(v_b.max_hp, 0) < 0.30 then
    v_per_hour_per_member := (v_per_hour_per_member * 0.5)::int;
  end if;
  v_per_hour_total_gold := v_per_hour_per_member * v_member_count;

  -- Letzte 24h Log
  select coalesce(jsonb_agg(jsonb_build_object(
    'at', l.created_at,
    'gold', l.delta_gold,
    'wood', l.delta_wood,
    'stone', l.delta_stone,
    'mana', l.delta_mana
  ) order by l.created_at desc), '[]'::jsonb)
  into v_log_24h
  from public.crew_treasury_log l
  where l.crew_id = v_b.crew_id
    and l.source = 'blackmarket_income'
    and l.ref_id = v_b.id
    and l.created_at > now() - interval '24 hours';

  return jsonb_build_object(
    'ok', true,
    'level', v_b.level,
    'hp', v_b.hp, 'max_hp', v_b.max_hp,
    'members', v_member_count,
    'per_hour_per_member', v_per_hour_per_member,
    'per_hour_total', jsonb_build_object(
      'gold', v_per_hour_total_gold,
      'wood', (v_per_hour_total_gold * 0.6)::int,
      'stone', (v_per_hour_total_gold * 0.6)::int,
      'mana', (v_per_hour_total_gold * 0.2)::int
    ),
    'last_tick_at', v_b.kind_data->>'last_tick_at',
    'last_income', v_b.kind_data->'last_income',
    'treasury', jsonb_build_object(
      'gold', coalesce(v_treasury.gold, 0),
      'wood', coalesce(v_treasury.wood, 0),
      'stone', coalesce(v_treasury.stone, 0),
      'mana', coalesce(v_treasury.mana, 0)
    ),
    'log_24h', v_log_24h
  );
end $$;
grant execute on function public.get_blackmarket_status(uuid) to authenticated;

-- ─── 2c) Schwarzmarkt: withdraw_to_user ─────────────────────────────────
-- Officer/Leader/Admin holt aus dem Treasury für sich raus (ggf. Subset).
create or replace function public.withdraw_crew_treasury(
  p_gold int default 0, p_wood int default 0, p_stone int default 0, p_mana int default 0
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_t record;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select crew_id, role into v_crew, v_role from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden',
      'hint', 'Nur Leader/Officer/Admin dürfen aus dem Schwarzmarkt abheben');
  end if;
  if greatest(p_gold, p_wood, p_stone, p_mana) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'nothing_requested');
  end if;

  select gold, wood, stone, mana into v_t from public.crew_treasury where crew_id = v_crew for update;
  if v_t is null then return jsonb_build_object('ok', false, 'error', 'empty_treasury'); end if;

  if v_t.gold < p_gold or v_t.wood < p_wood or v_t.stone < p_stone or v_t.mana < p_mana then
    return jsonb_build_object('ok', false, 'error', 'insufficient',
      'available', jsonb_build_object('gold', v_t.gold, 'wood', v_t.wood, 'stone', v_t.stone, 'mana', v_t.mana));
  end if;

  perform public._crew_treasury_apply(v_crew, 'withdraw', v_user, -p_gold, -p_wood, -p_stone, -p_mana, null);

  insert into public.user_resources (user_id, gold, wood, stone, mana)
       values (v_user, p_gold, p_wood, p_stone, p_mana)
  on conflict (user_id) do update set
    gold  = public.user_resources.gold  + excluded.gold,
    wood  = public.user_resources.wood  + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    mana  = public.user_resources.mana  + excluded.mana;

  return jsonb_build_object('ok', true,
    'withdrawn', jsonb_build_object('gold', p_gold, 'wood', p_wood, 'stone', p_stone, 'mana', p_mana));
end $$;
grant execute on function public.withdraw_crew_treasury(int, int, int, int) to authenticated;

-- ─── 3a) Bunker: Verteidigungs-Garrison-Tabelle ─────────────────────────
create table if not exists public.bunker_garrison (
  building_id uuid not null references public.crew_buildings(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  troop_id    text not null references public.troops_catalog(id) on delete cascade,
  count       int  not null default 0 check (count >= 0),
  deployed_at timestamptz not null default now(),
  primary key (building_id, user_id, troop_id)
);
create index if not exists idx_bunker_garrison_building on public.bunker_garrison(building_id);
alter table public.bunker_garrison enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bunker_garrison' and policyname='bunker_garrison_read_crew') then
    create policy bunker_garrison_read_crew on public.bunker_garrison for select using (
      exists (
        select 1 from public.crew_buildings b
         where b.id = bunker_garrison.building_id
           and b.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
      )
    );
  end if;
end $$;

-- ─── 3b) Bunker: deploy / withdraw garrison ─────────────────────────────
create or replace function public.bunker_deploy_troops(
  p_building_id uuid,
  p_troops jsonb            -- {"troop_id": count, ...}
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_b record;
  v_t record;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select id, crew_id, kind, hp into v_b
    from public.crew_buildings
   where id = p_building_id and destroyed_at is null;
  if v_b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_b.kind <> 'bunker' then return jsonb_build_object('ok', false, 'error', 'not_a_bunker'); end if;
  if v_b.hp <= 0 then return jsonb_build_object('ok', false, 'error', 'destroyed'); end if;
  if not exists (select 1 from public.crew_members where user_id = v_user and crew_id = v_b.crew_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  -- Pro troop_id: Truppen aus user_troops in bunker_garrison verschieben
  for k, v in select * from jsonb_each_text(p_troops) loop
    if (v::int) <= 0 then continue; end if;
    select count into v_t from public.user_troops where user_id = v_user and troop_id = k;
    if not found or v_t.count < v::int then
      return jsonb_build_object('ok', false, 'error', 'insufficient_troops', 'troop', k, 'have', coalesce(v_t.count, 0), 'need', v::int);
    end if;
    update public.user_troops set count = count - v::int where user_id = v_user and troop_id = k;
    insert into public.bunker_garrison (building_id, user_id, troop_id, count, deployed_at)
         values (p_building_id, v_user, k, v::int, now())
    on conflict (building_id, user_id, troop_id) do update
      set count = public.bunker_garrison.count + excluded.count,
          deployed_at = now();
  end loop;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.bunker_deploy_troops(uuid, jsonb) to authenticated;

create or replace function public.bunker_withdraw_troops(p_building_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_b record;
  g record;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select id, crew_id into v_b from public.crew_buildings where id = p_building_id;
  if v_b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  for g in
    select troop_id, count from public.bunker_garrison
     where building_id = p_building_id and user_id = v_user and count > 0
  loop
    insert into public.user_troops (user_id, troop_id, count)
         values (v_user, g.troop_id, g.count)
    on conflict (user_id, troop_id) do update
      set count = public.user_troops.count + excluded.count;
  end loop;
  delete from public.bunker_garrison
   where building_id = p_building_id and user_id = v_user;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.bunker_withdraw_troops(uuid) to authenticated;

-- ─── 3c) Bunker: Status-RPC ──────────────────────────────────────────────
create or replace function public.get_bunker_status(p_building_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_user uuid := auth.uid();
  v_b record;
  v_total_def bigint;
  v_garrison jsonb;
  v_my_troops jsonb;
  v_avail_troops jsonb;
begin
  select id, crew_id, level, hp, max_hp, kind_data
    into v_b from public.crew_buildings
   where id = p_building_id and kind = 'bunker' and destroyed_at is null;
  if v_b is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (select 1 from public.crew_members where user_id = v_user and crew_id = v_b.crew_id) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  -- Total-Defense ausgehend von Garrison (sum count*base_def)
  select coalesce(sum(g.count * tc.base_def), 0)::bigint into v_total_def
    from public.bunker_garrison g
    join public.troops_catalog tc on tc.id = g.troop_id
   where g.building_id = p_building_id;

  -- Garrison aufbereitet (pro user)
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id,
    'username', coalesce(u.display_name, u.username, '—'),
    'troops', x.troops
  )), '[]'::jsonb) into v_garrison
  from (
    select g.user_id, jsonb_object_agg(g.troop_id, g.count) as troops
      from public.bunker_garrison g
     where g.building_id = p_building_id and g.count > 0
     group by g.user_id
  ) x
  left join public.users u on u.id = x.user_id;

  -- Meine deployed-Truppen
  select coalesce(jsonb_object_agg(troop_id, count) filter (where count > 0), '{}'::jsonb)
    into v_my_troops
    from public.bunker_garrison
   where building_id = p_building_id and user_id = v_user;

  -- Meine verfügbaren Truppen
  select coalesce(jsonb_object_agg(troop_id, count) filter (where count > 0), '{}'::jsonb)
    into v_avail_troops
    from public.user_troops
   where user_id = v_user;

  return jsonb_build_object(
    'ok', true,
    'level', v_b.level, 'hp', v_b.hp, 'max_hp', v_b.max_hp,
    'total_defense', v_total_def,
    'garrison', v_garrison,
    'my_garrison', v_my_troops,
    'available_troops', v_avail_troops
  );
end $$;
grant execute on function public.get_bunker_status(uuid) to authenticated;

-- ─── 4) Hook in resolve_due_crew_repeater_attacks: Bunker-Counter + War-Score ──
-- Strategie: ein Trigger auf crew_repeater_attacks UPDATE wenn status: marching → done.
-- Wir kombinieren beide Effekte in einem Trigger damit wir die existing
-- resolve_due-Funktion nicht umschreiben müssen.

create or replace function public._on_repeater_attack_resolved()
returns trigger language plpgsql security definer as $$
declare
  v_repeater record;
  v_bunker record;
  v_total_def bigint := 0;
  v_dmg_to_attacker int := 0;
  v_war record;
  v_score_delta int;
begin
  -- Nur wenn gerade aufgelöst (status: marching → done)
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  select crew_id, lat, lng, kind into v_repeater
    from public.crew_repeaters where id = new.repeater_id;
  if v_repeater is null then return new; end if;

  -- 4a) Bunker im Umkreis von 600m berechnet Counter-Schaden auf Attacker-Truppen.
  for v_bunker in
    select b.id, b.crew_id
      from public.crew_buildings b
     where b.kind = 'bunker'
       and b.destroyed_at is null
       and b.hp > 0
       and b.crew_id = v_repeater.crew_id
       and (
         6371000 * 2 * asin(sqrt(
           power(sin(radians((b.lat - v_repeater.lat) / 2)), 2)
           + cos(radians(b.lat)) * cos(radians(v_repeater.lat))
           * power(sin(radians((b.lng - v_repeater.lng) / 2)), 2)
         ))
       ) < 600
  loop
    select coalesce(sum(g.count * tc.base_def), 0)::bigint into v_total_def
      from public.bunker_garrison g
      join public.troops_catalog tc on tc.id = g.troop_id
     where g.building_id = v_bunker.id;
    -- Counter-Schaden = 30% der Bunker-Defense, capped auf 60% vom total_atk
    v_dmg_to_attacker := least(
      (v_total_def * 0.30)::int,
      (new.total_atk * 0.60)::int
    );
    if v_dmg_to_attacker > 0 then
      -- Attacker-Verluste anteilig erhöhen: setze losses_attacker += counter-Schaden in 'extra_counter'
      update public.crew_repeater_attacks
         set losses_attacker = coalesce(losses_attacker, '{}'::jsonb)
                            || jsonb_build_object('_bunker_counter', v_dmg_to_attacker)
       where id = new.id;
      -- Inbox an Attacker (falls noch kein Sammel-Inbox-Insert läuft, einfach zusätzlich)
      insert into public.user_inbox (user_id, title, body, category)
      values (
        new.attacker_user_id,
        '🛡 Bunker-Counter',
        format('Ein Crew-Bunker hat zurückgeschlagen — zusätzlicher Schaden: %s.', v_dmg_to_attacker),
        'report'
      );
    end if;
  end loop;

  -- 4b) War-Score-Update wenn aktiver Krieg zwischen den Crews läuft
  if new.attacker_crew_id is not null then
    select id, attacker_crew, defender_crew into v_war
      from public.crew_wars
     where status = 'active'
       and (
            (attacker_crew = new.attacker_crew_id and defender_crew = v_repeater.crew_id)
         or (attacker_crew = v_repeater.crew_id   and defender_crew = new.attacker_crew_id)
       )
     order by declared_at desc limit 1;
    if v_war is not null then
      -- Punktevergabe: gewinnender Angreifer bekommt 100 (Repeater zerstört)
      -- bzw. 25 (Schaden), Verteidiger bekommt 50 für Defense-Win.
      v_score_delta := case
        when new.outcome = 'attacker_won' then 100
        when new.outcome = 'defender_won' then 25
        else 0
      end;
      if v_score_delta > 0 then
        if v_war.attacker_crew = new.attacker_crew_id then
          if new.outcome = 'attacker_won' then
            update public.crew_wars set attacker_score = attacker_score + 100 where id = v_war.id;
          else
            update public.crew_wars set defender_score = defender_score + 50 where id = v_war.id;
          end if;
        else
          if new.outcome = 'attacker_won' then
            update public.crew_wars set defender_score = defender_score + 100 where id = v_war.id;
          else
            update public.crew_wars set attacker_score = attacker_score + 50 where id = v_war.id;
          end if;
        end if;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_on_repeater_attack_resolved on public.crew_repeater_attacks;
create trigger trg_on_repeater_attack_resolved
  after update of status on public.crew_repeater_attacks
  for each row execute procedure public._on_repeater_attack_resolved();

-- ─── 5) Aktivitäts-Stats ins Repeater-Modal ──────────────────────────────
-- Erweitert get_repeater_turf_info um attacks_today, defenses_today,
-- repairs_today (über ansehen_log gibt's das nicht, also via crew_repeater_attacks
-- + ein Marker-Insert in ansehen_log mit source='repeater_repair').
-- repair_crew_repeater wird hier nicht angefasst — wir tracken einfach Reparaturen
-- über einen separaten Log: crew_repeater_repairs.
create table if not exists public.crew_repeater_repairs (
  id          uuid primary key default gen_random_uuid(),
  repeater_id uuid not null references public.crew_repeaters(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  hp_restored int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_crew_repeater_repairs_repeater
  on public.crew_repeater_repairs(repeater_id, created_at desc);

create or replace function public.get_repeater_turf_info(p_repeater_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_rep record;
  v_nb_id bigint;
  v_area_m2 double precision;
  v_streets text[];
  v_geom geometry;
  v_founder_name text;
  v_last_attack record;
  v_last_attacker_crew text;
  v_ansehen_total bigint;
  v_same_turf jsonb;
  v_adjacent jsonb;
  v_attacks_today int;
  v_defenses_today int;
  v_repairs_today int;
  v_repairs_today_hp int;
  v_blackmarket_id uuid;
  v_bunker_count int;
begin
  select id, lat, lng, kind, created_at, founder_user_id, crew_id
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   into v_rep;
  if v_rep is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Unbekannt') into v_founder_name
    from public.users where id = v_rep.founder_user_id;

  select created_at, resolved_at, attacker_crew_id, status, outcome, hp_damage
    into v_last_attack
    from public.crew_repeater_attacks
   where repeater_id = p_repeater_id
   order by coalesce(resolved_at, created_at) desc
   limit 1;

  if v_last_attack.attacker_crew_id is not null then
    select coalesce(name, 'Unbekannte Crew') into v_last_attacker_crew
      from public.crews where id = v_last_attack.attacker_crew_id;
  end if;

  select coalesce(sum(delta), 0) into v_ansehen_total
    from public.ansehen_log where ref_id = p_repeater_id;

  -- Heutige Aktivität (UTC-Tag, Spielstandard)
  select count(*) filter (where status = 'done')::int,
         count(*) filter (where status = 'done' and outcome = 'defender_won')::int
    into v_attacks_today, v_defenses_today
    from public.crew_repeater_attacks
   where repeater_id = p_repeater_id
     and created_at > now() - interval '24 hours';

  select count(*)::int, coalesce(sum(hp_restored), 0)::int
    into v_repairs_today, v_repairs_today_hp
    from public.crew_repeater_repairs
   where repeater_id = p_repeater_id
     and created_at > now() - interval '24 hours';

  v_nb_id := public._neighborhood_id_at(v_rep.lat, v_rep.lng);

  if v_nb_id is not null then
    select geom, area_m2 into v_geom, v_area_m2
      from public.neighborhood_blocks where id = v_nb_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', cr.id, 'kind', cr.kind, 'label', cr.label,
      'hp', cr.hp, 'max_hp', cr.max_hp
    ) order by cr.kind), '[]'::jsonb) into v_same_turf
    from public.crew_repeaters cr
    where cr.id <> v_rep.id
      and cr.crew_id = v_rep.crew_id
      and cr.destroyed_at is null
      and public._neighborhood_id_at(cr.lat, cr.lng) = v_nb_id;

    select coalesce(jsonb_agg(distinct jsonb_build_object(
      'crew_id', c.id,
      'crew_name', coalesce(c.name, '—'),
      'crew_tag', upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
      'repeater_count', cnt.n
    )), '[]'::jsonb) into v_adjacent
    from (
      select cr2.crew_id, count(*)::int as n
      from public.neighborhood_blocks nb
      join public.crew_repeaters cr2
        on cr2.destroyed_at is null
       and public._neighborhood_id_at(cr2.lat, cr2.lng) = nb.id
      where nb.id <> v_nb_id
        and ST_DWithin(nb.geom::geography, v_geom::geography, 5)
        and cr2.crew_id <> v_rep.crew_id
      group by cr2.crew_id
    ) cnt
    join public.crews c on c.id = cnt.crew_id;

    select array_agg(distinct ow.name order by ow.name) into v_streets
      from public._etl_osm_ways ow
     where ow.name is not null and ow.name <> ''
       and ow.highway in ('motorway','trunk','primary','secondary','tertiary',
                          'residential','unclassified')
       and ST_DWithin(ow.geom::geography, ST_Boundary(v_geom)::geography, 5);
  else
    declare v_radius int := public._repeater_turf_radius_for_kind(v_rep.kind);
    begin v_area_m2 := pi() * v_radius * v_radius; end;
  end if;

  -- Schwarzmarkt + Bunker im Umkreis (eigene Crew, < 800m)
  select id into v_blackmarket_id
    from public.crew_buildings
   where crew_id = v_rep.crew_id and kind = 'blackmarket' and destroyed_at is null
     and (6371000 * 2 * asin(sqrt(
           power(sin(radians((lat - v_rep.lat) / 2)), 2)
           + cos(radians(lat)) * cos(radians(v_rep.lat))
           * power(sin(radians((lng - v_rep.lng) / 2)), 2)
         ))) < 800
   limit 1;

  select count(*)::int into v_bunker_count
    from public.crew_buildings
   where crew_id = v_rep.crew_id and kind = 'bunker' and destroyed_at is null
     and (6371000 * 2 * asin(sqrt(
           power(sin(radians((lat - v_rep.lat) / 2)), 2)
           + cos(radians(lat)) * cos(radians(v_rep.lat))
           * power(sin(radians((lng - v_rep.lng) / 2)), 2)
         ))) < 600;

  return jsonb_build_object(
    'ok', true,
    'fallback_circle', v_nb_id is null,
    'area_m2', round(v_area_m2)::int,
    'boundary_streets', coalesce(to_jsonb(v_streets), '[]'::jsonb),
    'created_at', v_rep.created_at,
    'founder_name', v_founder_name,
    'last_attack_at', coalesce(v_last_attack.resolved_at, v_last_attack.created_at),
    'last_attacker_crew', v_last_attacker_crew,
    'last_attack_outcome', v_last_attack.outcome,
    'last_attack_status', v_last_attack.status,
    'ansehen_total', v_ansehen_total,
    'same_turf_repeaters', coalesce(v_same_turf, '[]'::jsonb),
    'adjacent_crews', coalesce(v_adjacent, '[]'::jsonb),
    'attacks_today', v_attacks_today,
    'defenses_today', v_defenses_today,
    'repairs_today', v_repairs_today,
    'repairs_today_hp', v_repairs_today_hp,
    'has_blackmarket', v_blackmarket_id is not null,
    'blackmarket_id', v_blackmarket_id,
    'bunker_count', v_bunker_count
  );
end $$;
grant execute on function public.get_repeater_turf_info(uuid) to authenticated;

-- repair_crew_repeater: log einen Repair-Eintrag für Aktivitäts-Stats.
-- Wir wrappen die existing Funktion: zusätzlich zum HP-Update einen Insert.
-- Da wir die existing Funktion nicht kennen ohne sie zu lesen, fügen wir
-- einen Trigger auf crew_repeaters hinzu der HP-Erhöhungen (nicht Verluste)
-- in crew_repeater_repairs loggt.
create or replace function public._on_crew_repeater_hp_change()
returns trigger language plpgsql security definer as $$
begin
  if new.hp > old.hp then
    insert into public.crew_repeater_repairs (repeater_id, user_id, hp_restored)
      values (new.id, auth.uid(), new.hp - old.hp);
  end if;
  return new;
end $$;

drop trigger if exists trg_crew_repeater_hp_change on public.crew_repeaters;
create trigger trg_crew_repeater_hp_change
  after update of hp on public.crew_repeaters
  for each row execute procedure public._on_crew_repeater_hp_change();

-- ─── 6) War-Helper-RPCs: Listen + Status ─────────────────────────────────
create or replace function public.list_my_crew_wars()
returns jsonb language plpgsql stable as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_active jsonb;
  v_history jsonb;
begin
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'attacker_crew_id', w.attacker_crew,
    'defender_crew_id', w.defender_crew,
    'attacker_name', ca.name,
    'attacker_tag',  upper(left(regexp_replace(coalesce(ca.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
    'defender_name', cd.name,
    'defender_tag',  upper(left(regexp_replace(coalesce(cd.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
    'declared_at', w.declared_at,
    'ends_at', w.ends_at,
    'attacker_score', w.attacker_score,
    'defender_score', w.defender_score,
    'is_my_crew_attacker', w.attacker_crew = v_crew
  ) order by w.declared_at desc), '[]'::jsonb) into v_active
  from public.crew_wars w
  join public.crews ca on ca.id = w.attacker_crew
  join public.crews cd on cd.id = w.defender_crew
  where w.status = 'active' and (w.attacker_crew = v_crew or w.defender_crew = v_crew);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'attacker_name', ca.name, 'defender_name', cd.name,
    'declared_at', w.declared_at, 'ended_at', w.ended_at,
    'attacker_score', w.attacker_score, 'defender_score', w.defender_score,
    'winner_crew_id', w.winner_crew,
    'is_winner', w.winner_crew = v_crew,
    'is_my_crew_attacker', w.attacker_crew = v_crew
  ) order by w.ended_at desc nulls last) filter (where w.id is not null), '[]'::jsonb) into v_history
  from public.crew_wars w
  join public.crews ca on ca.id = w.attacker_crew
  join public.crews cd on cd.id = w.defender_crew
  where w.status = 'ended'
    and (w.attacker_crew = v_crew or w.defender_crew = v_crew)
    and w.ended_at > now() - interval '90 days';

  return jsonb_build_object('ok', true, 'active', coalesce(v_active, '[]'::jsonb), 'history', coalesce(v_history, '[]'::jsonb));
end $$;
grant execute on function public.list_my_crew_wars() to authenticated;

-- Vorschläge für Kriegs-Targets: Anrainer-Crews der eigenen Repeater
create or replace function public.suggest_war_targets()
returns jsonb language plpgsql stable as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_targets jsonb;
begin
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  with my_blocks as (
    select distinct public._neighborhood_id_at(cr.lat, cr.lng) as nb_id
      from public.crew_repeaters cr
     where cr.crew_id = v_crew and cr.destroyed_at is null
  ),
  my_geoms as (
    select nb.id, nb.geom from public.neighborhood_blocks nb
     join my_blocks mb on mb.nb_id = nb.id
  ),
  adjacent_crews as (
    select cr2.crew_id, count(distinct cr2.id)::int as repeater_count
      from public.neighborhood_blocks nb
      join my_geoms mg on ST_DWithin(nb.geom::geography, mg.geom::geography, 5) and nb.id <> mg.id
      join public.crew_repeaters cr2 on cr2.destroyed_at is null
       and public._neighborhood_id_at(cr2.lat, cr2.lng) = nb.id
       and cr2.crew_id <> v_crew
     group by cr2.crew_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'crew_id', c.id,
    'name', c.name,
    'tag', upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
    'repeater_count', ac.repeater_count,
    'territory_color', coalesce(c.territory_color, '#FF2D78'),
    'has_active_war', exists (
      select 1 from public.crew_wars
       where status = 'active'
         and ((attacker_crew = v_crew and defender_crew = c.id)
           or (attacker_crew = c.id and defender_crew = v_crew))
    )
  ) order by ac.repeater_count desc), '[]'::jsonb) into v_targets
  from adjacent_crews ac
  join public.crews c on c.id = ac.crew_id;

  return jsonb_build_object('ok', true, 'targets', coalesce(v_targets, '[]'::jsonb));
end $$;
grant execute on function public.suggest_war_targets() to authenticated;
