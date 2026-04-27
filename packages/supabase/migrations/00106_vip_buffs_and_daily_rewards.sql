-- ══════════════════════════════════════════════════════════════════════════
-- VIP-EXPANSION (CoD-Style) — Granulare Buffs + Tägliche Belohnungen
-- ══════════════════════════════════════════════════════════════════════════
-- Erweitert vip_tier_thresholds um:
--   · march_speed_pct      (Truppen-Marsch-Speed)
--   · gather_speed_pct     (Resource-Sammeln-Speed)
--   · troop_atk_pct / troop_def_pct / troop_hp_pct
--   · daily_speed_tokens   (Speed-Tokens pro Daily-Claim)
--   · daily_vip_tickets    (VIP-Tickets pro Daily-Claim)
--
-- Plus Tagesgeschenk-Mechanik (1× pro UTC-Tag):
--   · vip_progress.last_daily_claim_date
--   · claim_vip_daily_rewards() RPC
--   · get_vip_buffs() liefert jetzt zusätzlich daily_claim_status
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Neue Buff-Spalten ────────────────────────────────────────────────
alter table public.vip_tier_thresholds
  add column if not exists march_speed_pct  numeric not null default 0,
  add column if not exists gather_speed_pct numeric not null default 0,
  add column if not exists troop_atk_pct    numeric not null default 0,
  add column if not exists troop_def_pct    numeric not null default 0,
  add column if not exists troop_hp_pct     numeric not null default 0,
  add column if not exists daily_speed_tokens int not null default 0,
  add column if not exists daily_vip_tickets  int not null default 0;

-- ─── 2) Werte je VIP-Tier setzen (sanfte Steigerung, CoD-inspiriert) ─────
update public.vip_tier_thresholds set
  gather_speed_pct = case vip_level
    when 0 then 0      when 1 then 0.05   when 2 then 0.05   when 3 then 0.10
    when 4 then 0.10   when 5 then 0.12   when 6 then 0.15   when 7 then 0.18
    when 8 then 0.20   when 9 then 0.20   when 10 then 0.20  when 11 then 0.25
    when 12 then 0.25  when 13 then 0.25  when 14 then 0.30  when 15 then 0.35
    else 0 end,
  march_speed_pct = case vip_level
    when 0 then 0      when 1 then 0      when 2 then 0      when 3 then 0
    when 4 then 0.02   when 5 then 0.02   when 6 then 0.03   when 7 then 0.03
    when 8 then 0.04   when 9 then 0.04   when 10 then 0.05  when 11 then 0.05
    when 12 then 0.06  when 13 then 0.06  when 14 then 0.08  when 15 then 0.10
    else 0 end,
  troop_atk_pct = case vip_level
    when 0 then 0      when 1 then 0      when 2 then 0      when 3 then 0
    when 4 then 0      when 5 then 0      when 6 then 0      when 7 then 0
    when 8 then 0.02   when 9 then 0.02   when 10 then 0.03  when 11 then 0.05
    when 12 then 0.05  when 13 then 0.07  when 14 then 0.08  when 15 then 0.10
    else 0 end,
  troop_def_pct = case vip_level
    when 12 then 0.05  when 13 then 0.05  when 14 then 0.07  when 15 then 0.10
    else 0 end,
  troop_hp_pct = case vip_level
    when 13 then 0.05  when 14 then 0.07  when 15 then 0.10
    else 0 end,
  daily_speed_tokens = case
    when vip_level <= 2 then 0
    when vip_level <= 5 then 1
    when vip_level <= 9 then 2
    when vip_level <= 13 then 3
    else 5 end,
  daily_vip_tickets = case
    when vip_level <= 4 then 0
    when vip_level <= 9 then 1
    when vip_level <= 13 then 2
    else 3 end;

-- ─── 3) vip_progress: Last-Daily-Claim ───────────────────────────────────
alter table public.vip_progress
  add column if not exists last_daily_claim_date date;

-- ─── 4) RPC: claim_vip_daily_rewards() — 1× pro UTC-Tag ──────────────────
create or replace function public.claim_vip_daily_rewards()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_progress record;
  v_tier record;
  v_silver int := 0;
  v_gold int := 0;
  v_speed int := 0;
  v_tickets int := 0;
  i int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  insert into public.vip_progress (user_id) values (v_user) on conflict do nothing;
  select * into v_progress from public.vip_progress where user_id = v_user for update;

  if v_progress.last_daily_claim_date = v_today then
    return jsonb_build_object('ok', false, 'error', 'already_claimed_today');
  end if;

  select * into v_tier from public.vip_tier_thresholds where vip_level = coalesce(v_progress.vip_level, 0);
  if v_tier is null then
    return jsonb_build_object('ok', false, 'error', 'tier_not_found');
  end if;

  v_silver  := coalesce(v_tier.daily_chest_silver, 0);
  v_gold    := coalesce(v_tier.daily_chest_gold, 0);
  v_speed   := coalesce(v_tier.daily_speed_tokens, 0);
  v_tickets := coalesce(v_tier.daily_vip_tickets, 0);

  -- Truhen einbuchen (treasure_chests aus 00079 — kind: silver/gold)
  for i in 1..v_silver loop
    insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
    values (v_user, 'silver', 'vip_daily', now() + interval '24 hours');
  end loop;
  for i in 1..v_gold loop
    insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
    values (v_user, 'gold', 'vip_daily', now() + interval '24 hours');
  end loop;

  -- Speed-Tokens + VIP-Tickets in user_resources
  if v_speed > 0 or v_tickets > 0 then
    insert into public.user_resources (user_id, speed_tokens, vip_tickets)
    values (v_user, v_speed, v_tickets)
    on conflict (user_id) do update set
      speed_tokens = public.user_resources.speed_tokens + v_speed,
      vip_tickets  = public.user_resources.vip_tickets  + v_tickets,
      updated_at = now();
  end if;

  update public.vip_progress set last_daily_claim_date = v_today where user_id = v_user;

  return jsonb_build_object('ok', true,
    'silver_chests', v_silver,
    'gold_chests', v_gold,
    'speed_tokens', v_speed,
    'vip_tickets', v_tickets,
    'vip_level', v_progress.vip_level);
end $$;
revoke all on function public.claim_vip_daily_rewards() from public;
grant execute on function public.claim_vip_daily_rewards() to authenticated;

-- ─── 5) get_vip_buffs() erweitern um neue Buff-Felder + Claim-Status ─────
create or replace function public.get_vip_buffs()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_progress record;
  v_today date := (now() at time zone 'utc')::date;
  v_claimed_today boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.vip_progress (user_id) values (v_user) on conflict do nothing;
  select * into v_progress from public.vip_progress where user_id = v_user;
  v_claimed_today := (v_progress.last_daily_claim_date = v_today);

  return jsonb_build_object('ok', true,
    'progress', jsonb_build_object(
      'vip_level', coalesce(v_progress.vip_level, 0),
      'vip_points', coalesce(v_progress.vip_points, 0)
    ),
    'daily_claim', jsonb_build_object(
      'claimed_today', coalesce(v_claimed_today, false),
      'last_claim_date', v_progress.last_daily_claim_date
    ),
    'tiers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'vip_level', vip_level,
        'required_points', required_points,
        'daily_chest_silver', daily_chest_silver,
        'daily_chest_gold', daily_chest_gold,
        'daily_speed_tokens', daily_speed_tokens,
        'daily_vip_tickets', daily_vip_tickets,
        'resource_bonus_pct', resource_bonus_pct,
        'buildtime_bonus_pct', buildtime_bonus_pct,
        'extra_build_slots', extra_build_slots,
        'extra_research_slots', extra_research_slots,
        'training_speed_pct', training_speed_pct,
        'research_speed_pct', research_speed_pct,
        'march_speed_pct', march_speed_pct,
        'gather_speed_pct', gather_speed_pct,
        'troop_atk_pct', troop_atk_pct,
        'troop_def_pct', troop_def_pct,
        'troop_hp_pct', troop_hp_pct
      ) order by vip_level), '[]'::jsonb)
      from public.vip_tier_thresholds
    ));
end $$;
revoke all on function public.get_vip_buffs() from public;
grant execute on function public.get_vip_buffs() to authenticated;
