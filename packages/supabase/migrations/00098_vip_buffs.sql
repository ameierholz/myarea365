-- ══════════════════════════════════════════════════════════════════════════
-- VIP-BUFFS — Read-Helper + RLS für vip_tier_thresholds
-- ══════════════════════════════════════════════════════════════════════════
-- vip_tier_thresholds hat bereits: resource_bonus_pct, buildtime_bonus_pct,
-- daily_chest_silver, daily_chest_gold, extra_build_slots, extra_research_slots,
-- training_speed_pct, research_speed_pct (via 00095).
-- ══════════════════════════════════════════════════════════════════════════

-- Tabelle für jedermann lesbar (Buff-Übersicht im VIP-Tab)
alter table public.vip_tier_thresholds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vip_tier_thresholds' and policyname='select_all') then
    create policy select_all on public.vip_tier_thresholds for select using (true);
  end if;
end $$;
grant select on public.vip_tier_thresholds to anon, authenticated;

-- get_vip_buffs() liefert User-VIP-Status + alle Tier-Buffs (für UI-Tabelle).
create or replace function public.get_vip_buffs()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_progress record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.vip_progress (user_id) values (v_user) on conflict do nothing;
  select * into v_progress from public.vip_progress where user_id = v_user;
  return jsonb_build_object('ok', true,
    'progress', jsonb_build_object(
      'vip_level', coalesce(v_progress.vip_level, 0),
      'vip_points', coalesce(v_progress.vip_points, 0)
    ),
    'tiers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'vip_level', vip_level,
        'required_points', required_points,
        'daily_chest_silver', daily_chest_silver,
        'daily_chest_gold', daily_chest_gold,
        'resource_bonus_pct', resource_bonus_pct,
        'buildtime_bonus_pct', buildtime_bonus_pct,
        'extra_build_slots', extra_build_slots,
        'extra_research_slots', extra_research_slots,
        'training_speed_pct', training_speed_pct,
        'research_speed_pct', research_speed_pct
      ) order by vip_level), '[]'::jsonb)
      from public.vip_tier_thresholds
    ));
end $$;
revoke all on function public.get_vip_buffs() from public;
grant execute on function public.get_vip_buffs() to authenticated;

-- VIP-Tickets einlösen → +X VIP-Punkte (Mapping: 1 Ticket = 50 Punkte).
create or replace function public.redeem_vip_ticket(p_count int default 1)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_have int := 0;
  v_pts int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_count is null or p_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;
  select vip_tickets into v_have from public.user_resources where user_id = v_user for update;
  if coalesce(v_have, 0) < p_count then
    return jsonb_build_object('ok', false, 'error', 'not_enough_tickets', 'have', coalesce(v_have, 0));
  end if;
  v_pts := p_count * 50;
  update public.user_resources set vip_tickets = vip_tickets - p_count, updated_at = now()
   where user_id = v_user;
  insert into public.vip_progress (user_id, vip_points) values (v_user, v_pts)
  on conflict (user_id) do update set vip_points = public.vip_progress.vip_points + v_pts;
  return jsonb_build_object('ok', true, 'points_added', v_pts, 'tickets_used', p_count);
end $$;
revoke all on function public.redeem_vip_ticket(int) from public;
grant execute on function public.redeem_vip_ticket(int) to authenticated;

-- Wächter-XP einsetzen → fügt einem aktiven Wächter XP zu.
-- Vorausgesetzt: Tabelle user_guardians mit (user_id, guardian_id, xp).
-- Wenn die Tabelle anders heißt, ist das hier ein Stub — bitte auf die echte
-- Tabellen-/Spaltennamen anpassen wenn notwendig.
create or replace function public.spend_guardian_xp(p_guardian_id text, p_amount int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_have int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  select guardian_xp into v_have from public.user_resources where user_id = v_user for update;
  if coalesce(v_have, 0) < p_amount then
    return jsonb_build_object('ok', false, 'error', 'not_enough_xp', 'have', coalesce(v_have, 0));
  end if;
  update public.user_resources set guardian_xp = guardian_xp - p_amount, updated_at = now()
   where user_id = v_user;
  -- Wächter-XP-Apply: hier idempotent in user_guardians (Tabelle muss existieren)
  -- update public.user_guardians set xp = xp + p_amount where user_id = v_user and guardian_id = p_guardian_id;
  return jsonb_build_object('ok', true, 'guardian_id', p_guardian_id, 'xp_spent', p_amount);
end $$;
revoke all on function public.spend_guardian_xp(text, int) from public;
grant execute on function public.spend_guardian_xp(text, int) to authenticated;
