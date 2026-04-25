-- ══════════════════════════════════════════════════════════════════════════
-- BASE-SYSTEM PHASE 3: Truppen + Crew-vs-Crew-Base-Angriffe
-- ══════════════════════════════════════════════════════════════════════════
-- - Truppen: trainierbar in Crew-Base, kosten Resourcen + Zeit
-- - Crew-vs-Crew-Angriffe: Angreifer-Crew schickt Truppen-Stack an gegnerische Base
-- - Berechnung deterministisch (Atk vs Def), Loot fließt an Sieger
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) troops_catalog (statisch) ────────────────────────────────────────
create table if not exists public.troops_catalog (
  id              text primary key,
  name            text not null,
  emoji           text not null,
  troop_class     text not null check (troop_class in ('infantry','cavalry','marksman','siege')),
  tier            int  not null check (tier between 1 and 5),
  base_atk        int  not null,
  base_def        int  not null,
  base_hp         int  not null,
  cost_wood       int  not null default 0,
  cost_stone      int  not null default 0,
  cost_gold       int  not null default 0,
  cost_mana       int  not null default 0,
  train_time_seconds int not null default 60,
  required_building_level int not null default 1,
  description     text not null
);

insert into public.troops_catalog (id, name, emoji, troop_class, tier, base_atk, base_def, base_hp,
  cost_wood, cost_stone, cost_gold, cost_mana, train_time_seconds, required_building_level, description)
values
  -- Tier 1
  ('miliz',         'Miliz',          '🪖', 'infantry', 1,  10,  12,  40,  20,  10,   0,   0,   30, 1, 'Schnell trainierte Wachen — günstig, wenig Schaden.'),
  ('jaeger',        'Jäger',          '🏹', 'marksman', 1,  14,   6,  30,  15,   5,   0,   0,   30, 1, 'Leichte Bogenschützen vom Land.'),
  ('reiter',        'Späher-Reiter',  '🐎', 'cavalry',  1,  12,   8,  35,  10,  10,   5,   0,   30, 1, 'Schnelle Kundschafter mit kurzen Klingen.'),
  -- Tier 2
  ('schwerttraeger','Schwertträger',  '⚔️', 'infantry', 2,  20,  22,  70,  40,  30,   5,   0,   90, 3, 'Erprobte Krieger mit Eisenklingen.'),
  ('langbogenschuetze','Langbogenschütze','🎯','marksman',2, 26, 10,  55,  30,  15,   5,   0,   90, 3, 'Langbogen aus Bergesche, hoher Crit.'),
  ('lanzenreiter',  'Lanzenreiter',   '🐴', 'cavalry',  2,  24,  16,  65,  25,  20,  10,   0,   90, 3, 'Schnellangriff mit gestreckter Lanze.'),
  -- Tier 3
  ('paladin',       'Paladin',        '🛡️', 'infantry', 3,  35,  40, 130,  80,  60,  20,  10,  240, 5, 'Schwerstgepanzerte Eliteinfanterie.'),
  ('arkanschuetze', 'Arkanschütze',   '🔮', 'marksman', 3,  45,  18,  95,  60,  30,  20,  20,  240, 5, 'Magisch verstärkte Pfeile aus Mana.'),
  ('drachenreiter', 'Drachenreiter',  '🐲', 'cavalry',  3,  42,  30, 115,  50,  40,  30,  10,  240, 6, 'Berittene Halbdrachen — Verheerung.'),
  -- Tier 4 (Belagerung)
  ('katapult',      'Katapult',       '🏰', 'siege',    4,  80,  20, 150, 200, 300,  50,   0,  600, 7, 'Bricht Crew-Mauern. Langsam, aber tödlich.'),
  ('arkanwerfer',   'Arkanwerfer',    '🌀', 'siege',    4,  95,  25, 140, 150, 250,  80,  80,  600, 8, 'Magie-Geschütz, ignoriert 30% DEF.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji,
  base_atk = excluded.base_atk, base_def = excluded.base_def, base_hp = excluded.base_hp,
  cost_wood = excluded.cost_wood, cost_stone = excluded.cost_stone,
  cost_gold = excluded.cost_gold, cost_mana = excluded.cost_mana,
  train_time_seconds = excluded.train_time_seconds,
  required_building_level = excluded.required_building_level,
  description = excluded.description;

-- ─── 2) user_troops (Solo-Inventar) + crew_troops (gemeinsamer Pool) ─────
create table if not exists public.user_troops (
  user_id  uuid not null references public.users(id) on delete cascade,
  troop_id text not null references public.troops_catalog(id) on delete cascade,
  count    int  not null default 0 check (count >= 0),
  primary key (user_id, troop_id)
);

create table if not exists public.crew_troops (
  crew_id  uuid not null references public.crews(id) on delete cascade,
  troop_id text not null references public.troops_catalog(id) on delete cascade,
  count    int  not null default 0 check (count >= 0),
  primary key (crew_id, troop_id)
);

alter table public.user_troops enable row level security;
alter table public.crew_troops enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_troops' and policyname='select_own') then
    create policy select_own on public.user_troops for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_troops' and policyname='select_member') then
    create policy select_member on public.crew_troops for select using (
      exists (select 1 from public.crew_members where crew_id = crew_id and user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 3) troop_training_queue ─────────────────────────────────────────────
create table if not exists public.troop_training_queue (
  id           uuid primary key default gen_random_uuid(),
  -- entweder solo (user_id) oder crew (crew_id)
  user_id      uuid references public.users(id) on delete cascade,
  crew_id      uuid references public.crews(id) on delete cascade,
  troop_id     text not null references public.troops_catalog(id) on delete cascade,
  count        int  not null check (count > 0),
  started_at   timestamptz not null default now(),
  ends_at      timestamptz not null,
  finished     boolean not null default false,
  check ((user_id is not null) <> (crew_id is not null))
);
create index if not exists idx_training_user on public.troop_training_queue(user_id) where user_id is not null;
create index if not exists idx_training_crew on public.troop_training_queue(crew_id) where crew_id is not null;
create index if not exists idx_training_open on public.troop_training_queue(ends_at) where not finished;

-- ─── 4) base_attacks (Crew-vs-Crew) ──────────────────────────────────────
create table if not exists public.base_attacks (
  id                uuid primary key default gen_random_uuid(),
  attacker_crew_id  uuid not null references public.crews(id) on delete cascade,
  defender_crew_id  uuid not null references public.crews(id) on delete cascade,
  initiated_by      uuid not null references public.users(id),
  troops_committed  jsonb not null,        -- {troop_id: count}
  started_at        timestamptz not null default now(),
  ends_at           timestamptz not null,  -- Marsch-Zeit
  resolved_at       timestamptz,
  outcome           text check (outcome in ('attacker_won','defender_won','draw')),
  loot              jsonb,                 -- {wood, stone, gold, mana}
  losses_attacker   jsonb,
  losses_defender   jsonb,
  check (attacker_crew_id <> defender_crew_id)
);
create index if not exists idx_attacks_atk on public.base_attacks(attacker_crew_id, started_at desc);
create index if not exists idx_attacks_def on public.base_attacks(defender_crew_id, started_at desc);
create index if not exists idx_attacks_open on public.base_attacks(ends_at) where resolved_at is null;

alter table public.base_attacks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_attacks' and policyname='select_member') then
    create policy select_member on public.base_attacks for select using (
      exists (select 1 from public.crew_members cm where cm.user_id = auth.uid()
              and cm.crew_id in (attacker_crew_id, defender_crew_id))
    );
  end if;
end $$;

-- ─── 5) RPC: train_troop() — startet Training, zieht Resourcen ───────────
create or replace function public.train_troop(p_troop_id text, p_count int, p_for_crew uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_t record;
  v_cw int; v_cs int; v_cg int; v_cm int;
  v_seconds int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_count < 1 or p_count > 1000 then return jsonb_build_object('ok', false, 'error', 'bad_count'); end if;
  select * into v_t from public.troops_catalog where id = p_troop_id;
  if v_t is null then return jsonb_build_object('ok', false, 'error', 'troop_not_found'); end if;

  v_cw := v_t.cost_wood  * p_count;
  v_cs := v_t.cost_stone * p_count;
  v_cg := v_t.cost_gold  * p_count;
  v_cm := v_t.cost_mana  * p_count;
  v_seconds := v_t.train_time_seconds * p_count;

  if p_for_crew is not null then
    if not exists (select 1 from public.crew_members where crew_id = p_for_crew and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'not_crew_member');
    end if;
    update public.crew_resources
       set wood = wood - v_cw, stone = stone - v_cs, gold = gold - v_cg, mana = mana - v_cm, updated_at = now()
     where crew_id = p_for_crew
       and wood >= v_cw and stone >= v_cs and gold >= v_cg and mana >= v_cm;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;

    insert into public.troop_training_queue (crew_id, troop_id, count, ends_at)
    values (p_for_crew, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  else
    update public.user_resources
       set wood = wood - v_cw, stone = stone - v_cs, gold = gold - v_cg, mana = mana - v_cm, updated_at = now()
     where user_id = v_user
       and wood >= v_cw and stone >= v_cs and gold >= v_cg and mana >= v_cm;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;

    insert into public.troop_training_queue (user_id, troop_id, count, ends_at)
    values (v_user, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  end if;

  return jsonb_build_object('ok', true, 'training_seconds', v_seconds);
end $$;

revoke all on function public.train_troop(text, int, uuid) from public;
grant execute on function public.train_troop(text, int, uuid) to authenticated;

-- ─── 6) RPC: finish_troop_training() — fertige Trainings ins Inventar ───
create or replace function public.finish_troop_training()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  q record; v_count int := 0;
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
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function public.finish_troop_training() from public;
grant execute on function public.finish_troop_training() to authenticated;

-- ─── 7) RPC: attack_crew_base() — Crew-vs-Crew Initiation ────────────────
-- Resolution erfolgt nach march_seconds (deterministisch) via finish_attack().
create or replace function public.attack_crew_base(p_target_crew_id uuid, p_troops jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_attacker_crew uuid;
  v_march_seconds int := 600; -- 10 Min Marsch
  k text; v_cnt int; v_have int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select crew_id into v_attacker_crew from public.crew_members where user_id = v_user limit 1;
  if v_attacker_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if v_attacker_crew = p_target_crew_id then return jsonb_build_object('ok', false, 'error', 'self_attack'); end if;

  -- Prüfen + abziehen aus crew_troops
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if (v_cnt::int) < 1 then continue; end if;
    select count into v_have from public.crew_troops where crew_id = v_attacker_crew and troop_id = k;
    if coalesce(v_have, 0) < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops', 'troop_id', k);
    end if;
    update public.crew_troops set count = count - v_cnt::int
     where crew_id = v_attacker_crew and troop_id = k;
  end loop;

  insert into public.base_attacks
    (attacker_crew_id, defender_crew_id, initiated_by, troops_committed, ends_at)
  values
    (v_attacker_crew, p_target_crew_id, v_user, p_troops, now() + (v_march_seconds || ' seconds')::interval);

  return jsonb_build_object('ok', true, 'march_seconds', v_march_seconds);
end $$;

revoke all on function public.attack_crew_base(uuid, jsonb) from public;
grant execute on function public.attack_crew_base(uuid, jsonb) to authenticated;

-- ─── 8) RPC: resolve_base_attack() — Berechnung wenn ends_at erreicht ────
-- Vereinfachte Engine: Σ(troop_atk × count) attacker vs Σ(troop_def × count) + 10% pro Mauer-Level defender
create or replace function public.resolve_base_attack(p_attack_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  a record;
  v_atk_power int := 0;
  v_def_power int := 0;
  v_def_wall_bonus numeric := 0;
  v_def_base record;
  v_loot_w int := 0; v_loot_s int := 0; v_loot_g int := 0; v_loot_m int := 0;
  v_outcome text;
  k text; v_cnt int;
  v_t record;
begin
  select * into a from public.base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early', 'ends_at', a.ends_at); end if;

  -- Attacker Atk-Power
  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    select * into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;
    v_atk_power := v_atk_power + v_t.base_atk * v_cnt::int;
  end loop;

  -- Defender Def-Power = sum of defender crew_troops
  select coalesce(sum(c.count * t.base_def), 0)::int into v_def_power
    from public.crew_troops c join public.troops_catalog t on t.id = c.troop_id
   where c.crew_id = a.defender_crew_id;

  -- Mauer-Bonus (Crew-Treffpunkt-Level zählt als Schutz)
  select * into v_def_base from public.crew_bases where crew_id = a.defender_crew_id;
  if v_def_base is not null then
    v_def_wall_bonus := v_def_base.level * 0.05;
    v_def_power := round(v_def_power * (1 + v_def_wall_bonus));
  end if;

  -- Outcome
  if v_atk_power > v_def_power * 1.10 then
    v_outcome := 'attacker_won';
    -- Loot: 20% der Defender-Resourcen
    select round(wood*0.20)::int, round(stone*0.20)::int, round(gold*0.20)::int, round(mana*0.20)::int
      into v_loot_w, v_loot_s, v_loot_g, v_loot_m
      from public.crew_resources where crew_id = a.defender_crew_id;
    update public.crew_resources set
      wood = wood - v_loot_w, stone = stone - v_loot_s,
      gold = gold - v_loot_g, mana = mana - v_loot_m, updated_at = now()
     where crew_id = a.defender_crew_id;
    insert into public.crew_resources (crew_id, wood, stone, gold, mana)
    values (a.attacker_crew_id, v_loot_w, v_loot_s, v_loot_g, v_loot_m)
    on conflict (crew_id) do update set
      wood = public.crew_resources.wood + excluded.wood,
      stone = public.crew_resources.stone + excluded.stone,
      gold = public.crew_resources.gold + excluded.gold,
      mana = public.crew_resources.mana + excluded.mana,
      updated_at = now();
  elsif v_def_power > v_atk_power * 1.10 then
    v_outcome := 'defender_won';
    -- Verluste: 70% der Angreifer-Truppen
  else
    v_outcome := 'draw';
  end if;

  update public.base_attacks set
    resolved_at = now(),
    outcome     = v_outcome,
    loot        = jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m),
    losses_attacker = jsonb_build_object('total_atk', v_atk_power, 'pct_lost', case when v_outcome = 'defender_won' then 70 else 30 end),
    losses_defender = jsonb_build_object('total_def', v_def_power, 'pct_lost', case when v_outcome = 'attacker_won' then 30 else 10 end)
   where id = p_attack_id;

  return jsonb_build_object('ok', true, 'outcome', v_outcome,
    'atk_power', v_atk_power, 'def_power', v_def_power,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m));
end $$;

revoke all on function public.resolve_base_attack(uuid) from public;
grant execute on function public.resolve_base_attack(uuid) to authenticated;
