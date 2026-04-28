-- ════════════════════════════════════════════════════════════════════
-- CREW-MODAL — Overview-RPC + Tech-Tree + Bounties + Crew-Shop
-- + User-Preference show_map_action_hud
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) User-Pref: Action-HUD an/aus ────────────────────────────────
alter table public.users add column if not exists show_map_action_hud boolean not null default true;

-- ─── 2) Crew-Tech (gemeinschaftliche Forschung mit Crew-Buffs) ──────
create table if not exists public.crew_tech_definitions (
  id            text primary key,
  name          text not null,
  description   text not null,
  category      text not null check (category in ('combat','economy','utility')),
  max_level     int  not null default 5,
  cost_gold_per_level   int not null default 5000,
  cost_wood_per_level   int not null default 2500,
  cost_stone_per_level  int not null default 2500,
  research_seconds_per_level int not null default 3600,
  effect_per_level numeric not null default 0.02
);

insert into public.crew_tech_definitions (id, name, description, category, effect_per_level) values
  ('crew_atk',       'Schlachtruf',     '+% ATK aller Crew-Truppen im Kampf', 'combat',  0.02),
  ('crew_def',       'Schildwall',      '+% DEF aller Crew-Truppen',           'combat',  0.02),
  ('crew_hp',        'Eisenhaut',       '+% HP aller Crew-Truppen',            'combat',  0.03),
  ('crew_march',     'Schnellmarsch',   '+% March-Capacity pro Mitglied',      'combat',  0.05),
  ('crew_train',     'Drillmeister',    '-% Truppen-Trainingszeit',            'economy', 0.05),
  ('crew_build',     'Baumeister',      '-% Bau-Zeit',                         'economy', 0.05),
  ('crew_research',  'Gelehrte',        '-% Forschungs-Zeit',                  'economy', 0.05),
  ('crew_yield',     'Erntemeister',    '+% RSS-Yield bei Walks',              'economy', 0.04),
  ('crew_shield',    'Wachturm',        '+% Repeater-Build-Shield-Zeit',       'utility', 0.10),
  ('crew_loot',      'Beutemeister',    '+% Loot bei Player-Base-Angriffen',   'utility', 0.05)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category, effect_per_level = excluded.effect_per_level;

create table if not exists public.crew_tech (
  crew_id     uuid not null references public.crews(id) on delete cascade,
  tech_id     text not null references public.crew_tech_definitions(id) on delete cascade,
  level       int  not null default 0,
  primary key (crew_id, tech_id)
);
create table if not exists public.crew_tech_queue (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  tech_id     text not null references public.crew_tech_definitions(id),
  target_level int not null,
  started_by  uuid not null references public.users(id),
  ends_at     timestamptz not null,
  finished    boolean not null default false
);
create index if not exists idx_crew_tech_q_open on public.crew_tech_queue(crew_id) where not finished;

alter table public.crew_tech enable row level security;
alter table public.crew_tech_queue enable row level security;
alter table public.crew_tech_definitions enable row level security;
drop policy if exists ct_read_member on public.crew_tech;
create policy ct_read_member on public.crew_tech for select using (
  crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
);
drop policy if exists ctq_read_member on public.crew_tech_queue;
create policy ctq_read_member on public.crew_tech_queue for select using (
  crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
);
drop policy if exists ctd_read_all on public.crew_tech_definitions;
create policy ctd_read_all on public.crew_tech_definitions for select using (true);

-- ─── 3) Crew-Bounties (Kopfgeld auf feindliche Spieler) ────────────
create table if not exists public.crew_bounties (
  id              uuid primary key default gen_random_uuid(),
  crew_id         uuid not null references public.crews(id) on delete cascade,
  posted_by       uuid not null references public.users(id) on delete cascade,
  target_user_id  uuid not null references public.users(id) on delete cascade,
  reward_gold     int  not null check (reward_gold >= 100),
  reason          text,
  status          text not null default 'open' check (status in ('open','claimed','expired','cancelled')),
  claimed_by      uuid references public.users(id),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz
);
create index if not exists idx_bounty_open on public.crew_bounties(crew_id) where status = 'open';
create index if not exists idx_bounty_target on public.crew_bounties(target_user_id) where status = 'open';

alter table public.crew_bounties enable row level security;
drop policy if exists b_read_member on public.crew_bounties;
create policy b_read_member on public.crew_bounties for select using (
  crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  or target_user_id = auth.uid()
);

-- ─── 4) Crew-Shop (Items kaufbar mit Crew-Coins) ───────────────────
create table if not exists public.crew_shop_items (
  id            text primary key,
  name          text not null,
  description   text not null,
  category      text not null check (category in ('boost','consumable','cosmetic')),
  price_coins   int not null check (price_coins > 0),
  payload       jsonb not null default '{}'::jsonb,
  active        boolean not null default true
);

insert into public.crew_shop_items (id, name, description, category, price_coins, payload) values
  ('boost_atk_1h',     'Kampfrausch (1h)',    '+15% ATK für 60 Minuten',     'boost',      500,  '{"buff":"atk","pct":15,"seconds":3600}'),
  ('boost_speed_30m',  'Bote (30m)',          '-30% March-Zeit für 30 min',  'boost',      300,  '{"buff":"march","pct":30,"seconds":1800}'),
  ('boost_yield_2h',   'Glückstag (2h)',      '+25% RSS bei Walks',          'boost',      400,  '{"buff":"yield","pct":25,"seconds":7200}'),
  ('consum_train_25',  'Drillschein',         'Trainings-Zeit -25% (1×)',    'consumable', 200,  '{"once":true,"buff":"train","pct":25}'),
  ('consum_speed_5m',  '5-Min-Speedup',       'Skip 5 Minuten in Queue',     'consumable', 100,  '{"speedup_seconds":300}'),
  ('cosmetic_banner',  'Crew-Banner-Skin',    'Goldener Banner für 30 Tage', 'cosmetic',   2000, '{"days":30}')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, price_coins = excluded.price_coins, payload = excluded.payload;

alter table public.crew_shop_items enable row level security;
drop policy if exists csi_read_all on public.crew_shop_items;
create policy csi_read_all on public.crew_shop_items for select using (true);

create table if not exists public.crew_shop_purchases (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  item_id     text not null references public.crew_shop_items(id),
  price_paid  int not null,
  created_at  timestamptz not null default now()
);
alter table public.crew_shop_purchases enable row level security;
drop policy if exists csp_read_member on public.crew_shop_purchases;
create policy csp_read_member on public.crew_shop_purchases for select using (
  crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
);

-- Crew-Coins kommen aus dem bestehenden crew_resources-Pool (gold)
-- (kein separater Coin-Pool nötig, gold ist bereits geteilte Crew-Währung)

-- ─── 5) RPC: get_crew_overview() ───────────────────────────────────
-- Liefert alle Daten für das Crew-Modal in einem Call.
create or replace function public.get_crew_overview(p_crew_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_crew_row record;
  v_ansehen_total bigint;
  v_member_count int;
  v_repeater_count int;
  v_territory_count int;
  v_resources record;
  v_leader record;
begin
  if v_user is null then return jsonb_build_object('error', 'auth_required'); end if;

  if p_crew_id is null then
    select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  else
    v_crew := p_crew_id;
  end if;
  if v_crew is null then return jsonb_build_object('error', 'no_crew'); end if;

  select * into v_crew_row from public.crews where id = v_crew;
  if v_crew_row is null then return jsonb_build_object('error', 'crew_not_found'); end if;

  select coalesce(sum(u.ansehen), 0) into v_ansehen_total
    from public.crew_members cm
    join public.users u on u.id = cm.user_id
   where cm.crew_id = v_crew;

  select count(*) into v_member_count from public.crew_members where crew_id = v_crew;

  select count(*) into v_repeater_count
    from public.crew_repeaters where crew_id = v_crew and destroyed_at is null;

  -- Territorium-Approximation: claimed_streets aller Crew-Mitglieder
  select count(distinct cs.id) into v_territory_count
    from public.crew_members cm
    left join public.claimed_streets cs on cs.user_id = cm.user_id
   where cm.crew_id = v_crew;

  select * into v_resources from public.crew_resources where crew_id = v_crew;

  select id, coalesce(display_name, username) as name, ansehen
    into v_leader
    from public.users
   where id = v_crew_row.owner_id;

  return jsonb_build_object(
    'crew', jsonb_build_object(
      'id', v_crew_row.id,
      'name', v_crew_row.name,
      'tag', upper(left(regexp_replace(coalesce(v_crew_row.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
      'color', v_crew_row.color,
      'zip', v_crew_row.zip,
      'created_at', v_crew_row.created_at
    ),
    'leader', case when v_leader is null then null else jsonb_build_object(
      'id', v_leader.id, 'name', v_leader.name, 'ansehen', v_leader.ansehen
    ) end,
    'stats', jsonb_build_object(
      'ansehen_total',   v_ansehen_total,
      'member_count',    v_member_count,
      'repeater_count',  v_repeater_count,
      'territory_count', v_territory_count
    ),
    'resources', case when v_resources is null then null else jsonb_build_object(
      'wood',  coalesce(v_resources.wood,  0),
      'stone', coalesce(v_resources.stone, 0),
      'gold',  coalesce(v_resources.gold,  0),
      'mana',  coalesce(v_resources.mana,  0)
    ) end
  );
end $$;
revoke all on function public.get_crew_overview(uuid) from public;
grant execute on function public.get_crew_overview(uuid) to authenticated;

-- ─── 6) RPC: get_crew_tech_state() ─────────────────────────────────
create or replace function public.get_crew_tech_state()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
begin
  if v_user is null then return jsonb_build_object('error','auth_required'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('error','no_crew'); end if;

  return jsonb_build_object(
    'definitions', (select coalesce(jsonb_agg(d.* order by d.category, d.id), '[]'::jsonb)
                      from public.crew_tech_definitions d),
    'progress',    (select coalesce(jsonb_agg(t.*), '[]'::jsonb)
                      from public.crew_tech t where t.crew_id = v_crew),
    'queue',       (select coalesce(jsonb_agg(q.*), '[]'::jsonb)
                      from public.crew_tech_queue q where q.crew_id = v_crew and not q.finished)
  );
end $$;
grant execute on function public.get_crew_tech_state() to authenticated;

-- ─── 7) RPC: start_crew_tech(p_tech_id) ────────────────────────────
create or replace function public.start_crew_tech(p_tech_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_def record;
  v_cur_level int;
  v_target int;
  v_cost_g int; v_cost_w int; v_cost_s int;
  v_secs int;
  v_res record;
  v_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok',false,'error','no_crew'); end if;

  select * into v_def from public.crew_tech_definitions where id = p_tech_id;
  if v_def is null then return jsonb_build_object('ok',false,'error','unknown_tech'); end if;

  -- Bereits etwas in der Queue?
  if exists (select 1 from public.crew_tech_queue where crew_id = v_crew and not finished) then
    return jsonb_build_object('ok',false,'error','queue_busy');
  end if;

  select coalesce(level, 0) into v_cur_level from public.crew_tech where crew_id = v_crew and tech_id = p_tech_id;
  v_target := v_cur_level + 1;
  if v_target > v_def.max_level then return jsonb_build_object('ok',false,'error','max_level'); end if;

  v_cost_g := v_def.cost_gold_per_level  * v_target;
  v_cost_w := v_def.cost_wood_per_level  * v_target;
  v_cost_s := v_def.cost_stone_per_level * v_target;
  v_secs   := v_def.research_seconds_per_level * v_target;

  select * into v_res from public.crew_resources where crew_id = v_crew for update;
  if v_res is null then return jsonb_build_object('ok',false,'error','no_resources_row'); end if;
  if v_res.gold < v_cost_g or v_res.wood < v_cost_w or v_res.stone < v_cost_s then
    return jsonb_build_object('ok',false,'error','insufficient_resources',
      'need', jsonb_build_object('gold',v_cost_g,'wood',v_cost_w,'stone',v_cost_s));
  end if;

  update public.crew_resources
     set gold = gold - v_cost_g, wood = wood - v_cost_w, stone = stone - v_cost_s
   where crew_id = v_crew;

  insert into public.crew_tech_queue (crew_id, tech_id, target_level, started_by, ends_at)
  values (v_crew, p_tech_id, v_target, v_user, now() + (v_secs || ' seconds')::interval)
  returning id into v_id;

  return jsonb_build_object('ok',true,'queue_id',v_id,'target_level',v_target,'ends_at', now() + (v_secs||' seconds')::interval);
end $$;
grant execute on function public.start_crew_tech(text) to authenticated;

-- ─── 8) RPC: finish_crew_tech() — von Polling/Cron getriggert ─────
create or replace function public.finish_crew_tech()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  q record;
  n int := 0;
begin
  if v_user is null then return 0; end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return 0; end if;
  for q in select * from public.crew_tech_queue
            where crew_id = v_crew and not finished and ends_at <= now()
            order by ends_at loop
    insert into public.crew_tech (crew_id, tech_id, level)
    values (v_crew, q.tech_id, q.target_level)
    on conflict (crew_id, tech_id) do update set level = excluded.level;
    update public.crew_tech_queue set finished = true where id = q.id;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.finish_crew_tech() to authenticated;

-- ─── 9) RPC: get_crew_bounties() / post_crew_bounty / claim_crew_bounty ─
create or replace function public.get_crew_bounties()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
begin
  if v_user is null then return jsonb_build_object('error','auth_required'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('error','no_crew'); end if;
  return jsonb_build_object('bounties', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'target_user_id', b.target_user_id,
      'target_name',    coalesce(tu.display_name, tu.username),
      'reward_gold',    b.reward_gold,
      'reason',         b.reason,
      'posted_by_name', coalesce(pu.display_name, pu.username),
      'expires_at',     b.expires_at,
      'created_at',     b.created_at
    ) order by b.created_at desc), '[]'::jsonb)
    from public.crew_bounties b
    join public.users tu on tu.id = b.target_user_id
    join public.users pu on pu.id = b.posted_by
    where b.crew_id = v_crew and b.status = 'open' and b.expires_at > now()
  ));
end $$;
grant execute on function public.get_crew_bounties() to authenticated;

create or replace function public.post_crew_bounty(p_target_user_id uuid, p_reward_gold int, p_reason text default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_res record;
  v_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  if p_reward_gold < 100 then return jsonb_build_object('ok',false,'error','min_100'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok',false,'error','no_crew'); end if;
  if p_target_user_id = v_user then return jsonb_build_object('ok',false,'error','self_target'); end if;

  -- Gold aus User-Resources zahlen (nicht Crew-Pool — der gehört allen)
  select * into v_res from public.user_resources where user_id = v_user for update;
  if coalesce(v_res.gold,0) < p_reward_gold then return jsonb_build_object('ok',false,'error','insufficient_gold'); end if;
  update public.user_resources set gold = gold - p_reward_gold where user_id = v_user;

  insert into public.crew_bounties (crew_id, posted_by, target_user_id, reward_gold, reason)
  values (v_crew, v_user, p_target_user_id, p_reward_gold, p_reason)
  returning id into v_id;

  return jsonb_build_object('ok',true,'bounty_id',v_id);
end $$;
grant execute on function public.post_crew_bounty(uuid, int, text) to authenticated;

-- ─── 10) RPC: Crew-Shop ────────────────────────────────────────────
create or replace function public.get_crew_shop()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_res record;
begin
  if v_user is null then return jsonb_build_object('error','auth_required'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('error','no_crew'); end if;
  select * into v_res from public.crew_resources where crew_id = v_crew;

  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(i.* order by i.category, i.price_coins), '[]'::jsonb)
                from public.crew_shop_items i where i.active),
    'crew_gold', coalesce(v_res.gold, 0),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'item_id', p.item_id, 'user_name', coalesce(u.display_name, u.username),
      'price', p.price_paid, 'at', p.created_at
    ) order by p.created_at desc), '[]'::jsonb)
      from public.crew_shop_purchases p
      join public.users u on u.id = p.user_id
      where p.crew_id = v_crew
      limit 10)
  );
end $$;
grant execute on function public.get_crew_shop() to authenticated;

create or replace function public.buy_crew_shop_item(p_item_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_item record;
  v_res record;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok',false,'error','no_crew'); end if;

  select * into v_item from public.crew_shop_items where id = p_item_id and active;
  if v_item is null then return jsonb_build_object('ok',false,'error','unknown_item'); end if;

  select * into v_res from public.crew_resources where crew_id = v_crew for update;
  if coalesce(v_res.gold,0) < v_item.price_coins then return jsonb_build_object('ok',false,'error','insufficient_crew_gold'); end if;

  update public.crew_resources set gold = gold - v_item.price_coins where crew_id = v_crew;
  insert into public.crew_shop_purchases (crew_id, user_id, item_id, price_paid)
  values (v_crew, v_user, p_item_id, v_item.price_coins);

  return jsonb_build_object('ok',true,'item', v_item.id, 'paid', v_item.price_coins);
end $$;
grant execute on function public.buy_crew_shop_item(text) to authenticated;
