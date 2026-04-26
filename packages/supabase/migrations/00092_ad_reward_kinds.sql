-- ══════════════════════════════════════════════════════════════════════════
-- AD-REWARDS: Daily (1×/Tag, +200 jede) + Cooldown (4×/Tag, +50 jede, 60min)
-- ══════════════════════════════════════════════════════════════════════════

-- 1) daily_ad_claims um pro-kind-counter erweitern
alter table public.daily_ad_claims
  add column if not exists daily_count      int not null default 0,
  add column if not exists cooldown_count   int not null default 0,
  add column if not exists cooldown_last_at timestamptz;

-- 2) ad_reward_config erweitern (split nach kind)
alter table public.ad_reward_config
  add column if not exists daily_kind_reward_wood          int not null default 200,
  add column if not exists daily_kind_reward_stone         int not null default 200,
  add column if not exists daily_kind_reward_gold          int not null default 200,
  add column if not exists daily_kind_reward_mana          int not null default 200,
  add column if not exists daily_kind_reward_speed_tokens  int not null default 1,
  add column if not exists cooldown_kind_reward_wood       int not null default 50,
  add column if not exists cooldown_kind_reward_stone      int not null default 50,
  add column if not exists cooldown_kind_reward_gold       int not null default 50,
  add column if not exists cooldown_kind_reward_mana       int not null default 50,
  add column if not exists cooldown_kind_reward_speed_tokens int not null default 0,
  add column if not exists cooldown_daily_limit            int not null default 4,
  add column if not exists cooldown_seconds                int not null default 3600;

-- 3) RPC: claim_ad_reward(kind)
drop function if exists public.claim_ad_reward();
create or replace function public.claim_ad_reward(p_kind text default 'daily')
returns jsonb language plpgsql security definer as $$
declare
  v_user       uuid := auth.uid();
  v_cfg        record;
  v_daily      int := 0;
  v_cd         int := 0;
  v_cd_last    timestamptz;
  v_remain     int := 0;
  v_rw int; v_rs int; v_rg int; v_rm int; v_rt int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('daily', 'cooldown') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;

  select * into v_cfg from public.ad_reward_config where id = 'default';

  insert into public.daily_ad_claims (user_id, claim_date)
  values (v_user, current_date)
  on conflict (user_id, claim_date) do nothing;

  select daily_count, cooldown_count, cooldown_last_at
    into v_daily, v_cd, v_cd_last
    from public.daily_ad_claims
   where user_id = v_user and claim_date = current_date;

  if p_kind = 'daily' then
    if v_daily >= 1 then
      return jsonb_build_object('ok', false, 'error', 'daily_already_claimed', 'kind', 'daily');
    end if;
    v_rw := v_cfg.daily_kind_reward_wood;
    v_rs := v_cfg.daily_kind_reward_stone;
    v_rg := v_cfg.daily_kind_reward_gold;
    v_rm := v_cfg.daily_kind_reward_mana;
    v_rt := v_cfg.daily_kind_reward_speed_tokens;
    update public.daily_ad_claims
       set daily_count = daily_count + 1
     where user_id = v_user and claim_date = current_date;
  else
    if v_cd >= v_cfg.cooldown_daily_limit then
      return jsonb_build_object('ok', false, 'error', 'cooldown_limit_reached',
                                'used', v_cd, 'limit', v_cfg.cooldown_daily_limit);
    end if;
    if v_cd_last is not null then
      v_remain := greatest(0, v_cfg.cooldown_seconds - extract(epoch from (now() - v_cd_last))::int);
      if v_remain > 0 then
        return jsonb_build_object('ok', false, 'error', 'cooldown_active',
                                  'cooldown_remaining', v_remain,
                                  'used', v_cd, 'limit', v_cfg.cooldown_daily_limit);
      end if;
    end if;
    v_rw := v_cfg.cooldown_kind_reward_wood;
    v_rs := v_cfg.cooldown_kind_reward_stone;
    v_rg := v_cfg.cooldown_kind_reward_gold;
    v_rm := v_cfg.cooldown_kind_reward_mana;
    v_rt := v_cfg.cooldown_kind_reward_speed_tokens;
    update public.daily_ad_claims
       set cooldown_count    = cooldown_count + 1,
           cooldown_last_at  = now()
     where user_id = v_user and claim_date = current_date;
  end if;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_rw, v_rs, v_rg, v_rm, v_rt)
  on conflict (user_id) do update set
    wood         = public.user_resources.wood + excluded.wood,
    stone        = public.user_resources.stone + excluded.stone,
    gold         = public.user_resources.gold + excluded.gold,
    mana         = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at   = now();

  return jsonb_build_object('ok', true, 'kind', p_kind,
    'daily_used',       case when p_kind = 'daily'    then v_daily + 1 else v_daily end,
    'cooldown_used',    case when p_kind = 'cooldown' then v_cd + 1    else v_cd end,
    'cooldown_limit',   v_cfg.cooldown_daily_limit,
    'cooldown_seconds', v_cfg.cooldown_seconds,
    'reward', jsonb_build_object('wood', v_rw, 'stone', v_rs, 'gold', v_rg, 'mana', v_rm, 'speed_tokens', v_rt));
end $$;

revoke all on function public.claim_ad_reward(text) from public;
grant execute on function public.claim_ad_reward(text) to authenticated;

-- 4) Status-RPC für UI (Buttons aktiv/inaktiv, Cooldown-Anzeige)
create or replace function public.get_ad_reward_status()
returns jsonb language plpgsql security definer as $$
declare
  v_user    uuid := auth.uid();
  v_cfg     record;
  v_daily   int := 0;
  v_cd      int := 0;
  v_cd_last timestamptz;
  v_remain  int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_cfg from public.ad_reward_config where id = 'default';
  select daily_count, cooldown_count, cooldown_last_at
    into v_daily, v_cd, v_cd_last
    from public.daily_ad_claims
   where user_id = v_user and claim_date = current_date;
  if v_cd_last is not null then
    v_remain := greatest(0, v_cfg.cooldown_seconds - extract(epoch from (now() - v_cd_last))::int);
  end if;
  return jsonb_build_object('ok', true,
    'daily_used',         coalesce(v_daily, 0),
    'daily_limit',        1,
    'cooldown_used',      coalesce(v_cd, 0),
    'cooldown_limit',     v_cfg.cooldown_daily_limit,
    'cooldown_seconds',   v_cfg.cooldown_seconds,
    'cooldown_remaining', v_remain,
    'daily_reward',    jsonb_build_object('wood', v_cfg.daily_kind_reward_wood,    'stone', v_cfg.daily_kind_reward_stone,
                                          'gold', v_cfg.daily_kind_reward_gold,    'mana',  v_cfg.daily_kind_reward_mana,
                                          'speed_tokens', v_cfg.daily_kind_reward_speed_tokens),
    'cooldown_reward', jsonb_build_object('wood', v_cfg.cooldown_kind_reward_wood, 'stone', v_cfg.cooldown_kind_reward_stone,
                                          'gold', v_cfg.cooldown_kind_reward_gold, 'mana',  v_cfg.cooldown_kind_reward_mana,
                                          'speed_tokens', v_cfg.cooldown_kind_reward_speed_tokens));
end $$;

revoke all on function public.get_ad_reward_status() from public;
grant execute on function public.get_ad_reward_status() to authenticated;
