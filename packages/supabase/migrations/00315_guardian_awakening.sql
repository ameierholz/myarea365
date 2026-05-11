-- 00315 — Wächter-Awakening (Endgame-Mechanik)
-- Erfordert star_level=5. Kostet 200 Sculpts des Archetyps. Setzt awakened=true
-- + awakened_at. Boostet Lebenspunkte/Angriff/Verteidigung über _guardian_awakening_mult.

-- RPC: awaken_guardian
create or replace function public.awaken_guardian(p_guardian_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_g record;
  v_cost int := 200;
  v_have int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into v_g from public.user_guardians where id = p_guardian_id and user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'guardian_not_found'); end if;

  if v_g.star_level < 5 then
    return jsonb_build_object('ok', false, 'error', 'needs_5_stars', 'star_level', v_g.star_level);
  end if;
  if v_g.awakened then
    return jsonb_build_object('ok', false, 'error', 'already_awakened');
  end if;

  select coalesce(count, 0) into v_have from public.guardian_sculpts
    where user_id = v_uid and archetype_id = v_g.archetype_id;
  if v_have < v_cost then
    return jsonb_build_object('ok', false, 'error', 'not_enough_sculpts', 'need', v_cost, 'have', v_have);
  end if;

  update public.guardian_sculpts set count = count - v_cost
    where user_id = v_uid and archetype_id = v_g.archetype_id;

  update public.user_guardians set
    awakened = true,
    awakened_at = now(),
    sculpts_collected = sculpts_collected + v_cost
    where id = p_guardian_id;

  return jsonb_build_object(
    'ok', true,
    'awakened_at', now(),
    'cost', v_cost,
    'bonus_hp_pct', 25,
    'bonus_atk_pct', 20,
    'bonus_def_pct', 20
  );
end $$;

grant execute on function public.awaken_guardian(uuid) to authenticated;

-- Awakening-Multiplikator-Helper (für Battle-Engines / Saga / etc.)
-- Liefert 1.0 (kein Effekt) oder den Awakening-Buff für den aktiven Wächter.
-- Stat-Werte:
--   hp  → 1.25 wenn awakened, sonst 1.0
--   atk → 1.20 wenn awakened, sonst 1.0
--   def → 1.20 wenn awakened, sonst 1.0
create or replace function public._guardian_awakening_mult(p_user uuid, p_stat text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when not exists (
      select 1 from public.user_guardians
      where user_id = p_user and is_active = true and awakened = true
    ) then 1.0
    when p_stat = 'hp' then 1.25
    when p_stat in ('atk', 'def') then 1.20
    else 1.0
  end;
$$;

grant execute on function public._guardian_awakening_mult(uuid, text) to authenticated, service_role;
