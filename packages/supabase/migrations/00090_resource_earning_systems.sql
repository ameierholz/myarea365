-- ══════════════════════════════════════════════════════════════════════════
-- RESOURCE-EARNING-SYSTEMS — 5 Wege Resourcen ohne (oder mit weniger) Laufen
-- ══════════════════════════════════════════════════════════════════════════
-- A) Ad-Rewards     — Werbung schauen → Resourcen
-- B) Daily-Quests   — kleine Tasks pro Tag mit Belohnung
-- C) Crew-Donations — Spende Resourcen an Crew-Mitglieder
-- D) Step-Sessions  — Schrittzähler (auch Rollstuhl-Schübe) → Resourcen
-- E) Resource-Pakete — Echtgeld-Käufe für Direkt-Resourcen
-- ══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- A) AD-REWARDS
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.daily_ad_claims (
  user_id      uuid not null references public.users(id) on delete cascade,
  claim_date   date not null default current_date,
  claims_count int  not null default 0 check (claims_count >= 0),
  primary key (user_id, claim_date)
);

alter table public.daily_ad_claims enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='daily_ad_claims' and policyname='select_own') then
    create policy select_own on public.daily_ad_claims for select using (auth.uid() = user_id);
  end if;
end $$;

-- Konfiguration
create table if not exists public.ad_reward_config (
  id text primary key default 'default',
  daily_limit int not null default 5,
  reward_wood int not null default 200,
  reward_stone int not null default 200,
  reward_gold int not null default 200,
  reward_mana int not null default 200,
  reward_speed_tokens int not null default 1
);
insert into public.ad_reward_config (id) values ('default') on conflict do nothing;

create or replace function public.claim_ad_reward()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_count int;
  v_limit int;
  v_cfg record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_cfg from public.ad_reward_config where id = 'default';
  v_limit := coalesce(v_cfg.daily_limit, 5);

  insert into public.daily_ad_claims (user_id, claim_date, claims_count)
  values (v_user, current_date, 0)
  on conflict (user_id, claim_date) do nothing;

  select claims_count into v_count from public.daily_ad_claims
    where user_id = v_user and claim_date = current_date;

  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'daily_limit_reached', 'used', v_count, 'limit', v_limit);
  end if;

  update public.daily_ad_claims set claims_count = claims_count + 1
    where user_id = v_user and claim_date = current_date;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_cfg.reward_wood, v_cfg.reward_stone, v_cfg.reward_gold, v_cfg.reward_mana, v_cfg.reward_speed_tokens)
  on conflict (user_id) do update set
    wood = public.user_resources.wood + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    gold = public.user_resources.gold + excluded.gold,
    mana = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at = now();

  return jsonb_build_object('ok', true, 'used', v_count + 1, 'limit', v_limit,
    'reward', jsonb_build_object(
      'wood', v_cfg.reward_wood, 'stone', v_cfg.reward_stone,
      'gold', v_cfg.reward_gold, 'mana', v_cfg.reward_mana,
      'speed_tokens', v_cfg.reward_speed_tokens));
end $$;
revoke all on function public.claim_ad_reward() from public;
grant execute on function public.claim_ad_reward() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- B) DAILY-QUESTS
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.quest_definitions (
  id          text primary key,
  name        text not null,
  description text not null,
  emoji       text not null,
  quest_type  text not null check (quest_type in ('login','build_any','open_chest','walk_km','arena_fight','crew_donate','shop_qr_scan','train_guardian','upgrade_building')),
  target      int  not null default 1,
  reward_wood int  not null default 0,
  reward_stone int not null default 0,
  reward_gold int  not null default 0,
  reward_mana int  not null default 0,
  weight      int  not null default 10  -- höhere Zahl = häufiger
);

insert into public.quest_definitions
  (id, name, description, emoji, quest_type, target, reward_wood, reward_stone, reward_gold, reward_mana, weight)
values
  ('login_today',      'Tagesgruß',       'Logge dich heute mindestens einmal ein.',                  '👋', 'login',          1,  100, 100, 100, 100, 30),
  ('walk_1km',         'Erste Runde',     'Lauf 1 km.',                                                '🚶', 'walk_km',        1,  150, 150, 150,  50, 20),
  ('walk_5km',         'Streifzug',       'Lauf 5 km.',                                                '🏃', 'walk_km',        5,  500, 500, 300, 200, 15),
  ('build_today',      'Baumeister',      'Bau oder upgrade ein Gebäude.',                             '🏗️', 'build_any',      1,  200, 200, 100,  50, 25),
  ('upgrade_2x',       'Doppel-Upgrade',  'Upgrade zwei Gebäude heute.',                               '⬆️', 'upgrade_building',2, 400, 400, 200, 100, 10),
  ('open_silver_chest','Truhen-Jäger',    'Öffne eine Silber-Truhe.',                                  '🥈', 'open_chest',     1,  100, 100, 200,  50, 20),
  ('arena_win',        'Kampf-Sieg',      'Gewinne 1 Arena-Kampf.',                                    '⚔️', 'arena_fight',    1,  150, 150, 300, 100, 15),
  ('crew_help',        'Großzügig',       'Spende Resourcen an ein Crew-Mitglied.',                    '🤝', 'crew_donate',    1,    0,   0, 200, 200, 10),
  ('shop_qr',          'Kiez-Pflege',     'Scanne einen QR-Code in einem lokalen Geschäft.',           '🏪', 'shop_qr_scan',   1,  300, 300, 300, 100, 12),
  ('train_2',          'Wächter-Training','Trainiere zwei Wächter.',                                   '🛡️', 'train_guardian', 2,  100, 100, 200, 200, 10)
on conflict (id) do update set
  name=excluded.name, description=excluded.description, emoji=excluded.emoji,
  quest_type=excluded.quest_type, target=excluded.target,
  reward_wood=excluded.reward_wood, reward_stone=excluded.reward_stone,
  reward_gold=excluded.reward_gold, reward_mana=excluded.reward_mana, weight=excluded.weight;

alter table public.quest_definitions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='quest_definitions' and policyname='select_all') then
    create policy select_all on public.quest_definitions for select using (true);
  end if;
end $$;
grant select on public.quest_definitions to anon, authenticated;

create table if not exists public.user_daily_quests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  quest_id    text not null references public.quest_definitions(id) on delete cascade,
  quest_date  date not null default current_date,
  progress    int  not null default 0,
  target      int  not null,
  claimed     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, quest_id, quest_date)
);
create index if not exists idx_user_quests_today on public.user_daily_quests(user_id, quest_date);

alter table public.user_daily_quests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_daily_quests' and policyname='select_own') then
    create policy select_own on public.user_daily_quests for select using (auth.uid() = user_id);
  end if;
end $$;

-- Lazy-Assign: wählt 4 zufällige Quests pro Tag, wenn noch keine existieren
create or replace function public.ensure_daily_quests()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_existing int;
  v_picked record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select count(*) into v_existing from public.user_daily_quests
    where user_id = v_user and quest_date = current_date;
  if v_existing > 0 then return jsonb_build_object('ok', true, 'created', 0); end if;

  for v_picked in
    select id, target from public.quest_definitions
    order by random() * weight desc limit 4
  loop
    insert into public.user_daily_quests (user_id, quest_id, target)
    values (v_user, v_picked.id, v_picked.target)
    on conflict do nothing;
  end loop;

  -- Login-Quest sofort als erfüllt markieren
  update public.user_daily_quests
    set progress = target
    where user_id = v_user and quest_date = current_date
      and quest_id in (select id from public.quest_definitions where quest_type = 'login');

  return jsonb_build_object('ok', true, 'created', 4);
end $$;
revoke all on function public.ensure_daily_quests() from public;
grant execute on function public.ensure_daily_quests() to authenticated;

-- Quest-Progress bumpen (von anderen RPCs aufgerufen)
create or replace function public.bump_quest(p_quest_type text, p_amount int default 1)
returns void language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  update public.user_daily_quests udq
    set progress = least(udq.progress + p_amount, udq.target)
    from public.quest_definitions qd
    where udq.quest_id = qd.id and qd.quest_type = p_quest_type
      and udq.user_id = v_user and udq.quest_date = current_date
      and not udq.claimed;
end $$;
revoke all on function public.bump_quest(text, int) from public;
grant execute on function public.bump_quest(text, int) to authenticated;

create or replace function public.claim_quest(p_quest_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_q record;
  v_def record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_q from public.user_daily_quests where id = p_quest_id and user_id = v_user;
  if v_q is null then raise exception 'quest_not_found'; end if;
  if v_q.claimed then return jsonb_build_object('ok', false, 'error', 'already_claimed'); end if;
  if v_q.progress < v_q.target then return jsonb_build_object('ok', false, 'error', 'not_complete'); end if;

  select * into v_def from public.quest_definitions where id = v_q.quest_id;

  insert into public.user_resources (user_id, wood, stone, gold, mana)
  values (v_user, v_def.reward_wood, v_def.reward_stone, v_def.reward_gold, v_def.reward_mana)
  on conflict (user_id) do update set
    wood = public.user_resources.wood + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    gold = public.user_resources.gold + excluded.gold,
    mana = public.user_resources.mana + excluded.mana,
    updated_at = now();

  update public.user_daily_quests set claimed = true where id = p_quest_id;

  return jsonb_build_object('ok', true,
    'reward', jsonb_build_object('wood', v_def.reward_wood, 'stone', v_def.reward_stone, 'gold', v_def.reward_gold, 'mana', v_def.reward_mana));
end $$;
revoke all on function public.claim_quest(uuid) from public;
grant execute on function public.claim_quest(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- C) CREW-DONATIONS
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.crew_resource_donations (
  id            uuid primary key default gen_random_uuid(),
  crew_id       uuid not null references public.crews(id) on delete cascade,
  from_user     uuid not null references public.users(id) on delete cascade,
  to_user       uuid not null references public.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('wood','stone','gold','mana')),
  amount        int  not null check (amount > 0),
  sent_at       timestamptz not null default now()
);
create index if not exists idx_donations_to on public.crew_resource_donations(to_user, sent_at desc);
create index if not exists idx_donations_from on public.crew_resource_donations(from_user, sent_at desc);

alter table public.crew_resource_donations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_resource_donations' and policyname='select_involved') then
    create policy select_involved on public.crew_resource_donations for select using (
      auth.uid() = from_user or auth.uid() = to_user
    );
  end if;
end $$;

create or replace function public.donate_to_crew_member(
  p_to_user uuid, p_resource_type text, p_amount int
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_other_crew uuid;
  v_have int;
  v_received_today int;
  v_max_daily_received int := 5000;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_amount <= 0 or p_amount > 1000 then raise exception 'amount_out_of_bounds'; end if;
  if p_resource_type not in ('wood','stone','gold','mana') then raise exception 'invalid_resource'; end if;
  if v_user = p_to_user then raise exception 'cannot_donate_to_self'; end if;

  -- Beide müssen in derselben Crew sein
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  select crew_id into v_other_crew from public.crew_members where user_id = p_to_user limit 1;
  if v_crew is null or v_crew <> v_other_crew then raise exception 'not_same_crew'; end if;

  -- Spender hat genug?
  execute format('select %I from public.user_resources where user_id = $1', p_resource_type)
    into v_have using v_user;
  if coalesce(v_have, 0) < p_amount then return jsonb_build_object('ok', false, 'error', 'insufficient'); end if;

  -- Tageslimit beim Empfänger?
  select coalesce(sum(amount), 0) into v_received_today
    from public.crew_resource_donations
    where to_user = p_to_user and sent_at::date = current_date;
  if v_received_today + p_amount > v_max_daily_received then
    return jsonb_build_object('ok', false, 'error', 'recipient_daily_limit', 'limit', v_max_daily_received, 'used', v_received_today);
  end if;

  -- Transfer
  execute format('update public.user_resources set %1$I = %1$I - $2, updated_at = now() where user_id = $1', p_resource_type)
    using v_user, p_amount;
  execute format('update public.user_resources set %1$I = %1$I + $2, updated_at = now() where user_id = $1', p_resource_type)
    using p_to_user, p_amount;

  insert into public.crew_resource_donations (crew_id, from_user, to_user, resource_type, amount)
  values (v_crew, v_user, p_to_user, p_resource_type, p_amount);

  perform public.bump_quest('crew_donate', 1);

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.donate_to_crew_member(uuid, text, int) from public;
grant execute on function public.donate_to_crew_member(uuid, text, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- D) STEP-SESSIONS (Schrittzähler / Rollstuhl-Schübe)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.step_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  steps        int  not null check (steps > 0),
  source       text not null check (source in ('healthkit','googlefit','manual','wheelchair')),
  recorded_for date not null default current_date,
  km_estimated numeric(6,3) not null,
  resources_awarded boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_step_sessions_user on public.step_sessions(user_id, recorded_for desc);

alter table public.step_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='step_sessions' and policyname='select_own') then
    create policy select_own on public.step_sessions for select using (auth.uid() = user_id);
  end if;
end $$;

-- Konvertierung Schritte → km (~1300 Schritte/km Standardwert)
-- Bei wheelchair: pro Schub ~1m → ~1000 "Schübe" /km
create or replace function public.record_step_session(
  p_steps int, p_source text default 'manual'
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_today_steps int;
  v_max_daily int := 50000;     -- Anti-Abuse: max 50k Schritte/Tag (~38 km)
  v_steps_per_km int;
  v_km numeric;
  v_drop_each int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_steps <= 0 then raise exception 'invalid_steps'; end if;
  if p_source not in ('healthkit','googlefit','manual','wheelchair') then raise exception 'invalid_source'; end if;

  select coalesce(sum(steps), 0) into v_today_steps
    from public.step_sessions where user_id = v_user and recorded_for = current_date;
  if v_today_steps + p_steps > v_max_daily then
    return jsonb_build_object('ok', false, 'error', 'daily_limit', 'limit', v_max_daily, 'used', v_today_steps);
  end if;

  v_steps_per_km := case when p_source = 'wheelchair' then 1000 else 1300 end;
  v_km := round(p_steps::numeric / v_steps_per_km, 3);

  insert into public.step_sessions (user_id, steps, source, km_estimated, resources_awarded)
  values (v_user, p_steps, p_source, v_km, true);

  -- 50/km für jede Resource (geringerer Drop als richtige Walks weil keine Geo-Klassifizierung)
  v_drop_each := round(v_km * 50);
  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_drop_each, v_drop_each, v_drop_each, v_drop_each, floor(v_km)::int)
  on conflict (user_id) do update set
    wood = public.user_resources.wood + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    gold = public.user_resources.gold + excluded.gold,
    mana = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at = now();

  perform public.bump_quest('walk_km', floor(v_km)::int);

  return jsonb_build_object('ok', true, 'km', v_km,
    'reward', jsonb_build_object('each', v_drop_each, 'speed_tokens', floor(v_km)::int));
end $$;
revoke all on function public.record_step_session(int, text) from public;
grant execute on function public.record_step_session(int, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- E) RESOURCE-PAKETE (Echtgeld-Käufe — Fulfillment-RPC)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.resource_packages (
  id           text primary key,
  name         text not null,
  description  text not null,
  price_cents  int  not null,
  reward_wood  int  not null default 0,
  reward_stone int  not null default 0,
  reward_gold  int  not null default 0,
  reward_mana  int  not null default 0,
  reward_speed_tokens int not null default 0,
  bonus_label  text,
  sort         int  not null default 0,
  active       boolean not null default true
);

insert into public.resource_packages
  (id, name, description, price_cents, reward_wood, reward_stone, reward_gold, reward_mana, reward_speed_tokens, bonus_label, sort)
values
  ('starter',  'Starter-Paket', 'Schneller Einstieg für neue Bases.',          99,  1000, 1000, 1000, 1000,  5, null,                1),
  ('bronze',   'Bronze-Paket',  'Mittlerer Boost für 1-2 Stufen.',            499,  6000, 6000, 6000, 6000, 30, null,                2),
  ('silber',   'Silber-Paket',  'Großer Boost + Bonus-Tokens.',               999, 14000,14000,14000,14000, 75, '+10% Bonus',        3),
  ('gold',     'Gold-Paket',    'XL-Paket für Endgame-Builds.',              1999, 32000,32000,32000,32000,200, '+25% Bonus',        4),
  ('super',    'Super-Bundle',  'Massive Resourcen + Speed-Tokens.',         4999, 90000,90000,90000,90000,600, '+50% Bonus · BEST', 5)
on conflict (id) do update set
  name=excluded.name, description=excluded.description, price_cents=excluded.price_cents,
  reward_wood=excluded.reward_wood, reward_stone=excluded.reward_stone,
  reward_gold=excluded.reward_gold, reward_mana=excluded.reward_mana,
  reward_speed_tokens=excluded.reward_speed_tokens, bonus_label=excluded.bonus_label,
  sort=excluded.sort, active=excluded.active;

alter table public.resource_packages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='resource_packages' and policyname='select_active') then
    create policy select_active on public.resource_packages for select using (active);
  end if;
end $$;
grant select on public.resource_packages to anon, authenticated;

create table if not exists public.resource_package_purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  package_id  text not null references public.resource_packages(id),
  payment_token text,        -- vom Payment-Provider (Stripe, Apple, Google)
  amount_paid_cents int not null,
  fulfilled   boolean not null default true,
  purchased_at timestamptz not null default now()
);
create index if not exists idx_purchases_user on public.resource_package_purchases(user_id, purchased_at desc);

alter table public.resource_package_purchases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='resource_package_purchases' and policyname='select_own') then
    create policy select_own on public.resource_package_purchases for select using (auth.uid() = user_id);
  end if;
end $$;

-- Wird vom Payment-Webhook aufgerufen NACHDEM Zahlung bestätigt ist.
-- Service-Role-only (Webhook-Server läuft mit service_role) — kein authenticated grant.
create or replace function public.fulfill_resource_package(
  p_user_id uuid, p_package_id text, p_payment_token text
) returns jsonb language plpgsql security definer as $$
declare v_pkg record;
begin
  select * into v_pkg from public.resource_packages where id = p_package_id and active;
  if v_pkg is null then raise exception 'package_not_found'; end if;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (p_user_id, v_pkg.reward_wood, v_pkg.reward_stone, v_pkg.reward_gold, v_pkg.reward_mana, v_pkg.reward_speed_tokens)
  on conflict (user_id) do update set
    wood = public.user_resources.wood + excluded.wood,
    stone = public.user_resources.stone + excluded.stone,
    gold = public.user_resources.gold + excluded.gold,
    mana = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at = now();

  insert into public.resource_package_purchases (user_id, package_id, payment_token, amount_paid_cents)
  values (p_user_id, p_package_id, p_payment_token, v_pkg.price_cents);

  return jsonb_build_object('ok', true, 'package_id', p_package_id);
end $$;
revoke all on function public.fulfill_resource_package(uuid, text, text) from public;
-- Nur service_role — keine authenticated/anon grants.
