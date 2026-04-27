-- ══════════════════════════════════════════════════════════════════════════
-- spend_guardian_xp — Stub aus 00098 ersetzen, jetzt wirklich auf
-- public.user_guardians (id uuid, user_id uuid, xp int) verdrahten.
-- Signatur ändert sich von (p_guardian_id text, p_amount int)
--                       → (p_guardian_id uuid, p_amount int)
-- → DROP FUNCTION zwingend vor CREATE OR REPLACE.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists public.spend_guardian_xp(text, int);
drop function if exists public.spend_guardian_xp(uuid, int);

create or replace function public.spend_guardian_xp(p_guardian_id uuid, p_amount int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_have int := 0;
  v_owner uuid;
  v_new_xp int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  -- Owner-Check: gehört der Wächter dem User?
  select user_id into v_owner from public.user_guardians where id = p_guardian_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'guardian_not_found');
  end if;
  if v_owner <> v_user then
    return jsonb_build_object('ok', false, 'error', 'not_your_guardian');
  end if;

  -- guardian_xp Pool aus user_resources sperren + abziehen
  select guardian_xp into v_have from public.user_resources where user_id = v_user for update;
  if coalesce(v_have, 0) < p_amount then
    return jsonb_build_object('ok', false, 'error', 'not_enough_xp', 'have', coalesce(v_have, 0));
  end if;
  update public.user_resources
     set guardian_xp = guardian_xp - p_amount, updated_at = now()
   where user_id = v_user;

  -- Wächter-XP erhöhen
  update public.user_guardians
     set xp = coalesce(xp, 0) + p_amount
   where id = p_guardian_id and user_id = v_user
   returning xp into v_new_xp;

  return jsonb_build_object(
    'ok', true,
    'guardian_id', p_guardian_id,
    'xp_spent', p_amount,
    'guardian_xp_new', v_new_xp
  );
end $$;
revoke all on function public.spend_guardian_xp(uuid, int) from public;
grant execute on function public.spend_guardian_xp(uuid, int) to authenticated;
