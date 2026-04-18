-- Prueft ob eine Crew in den letzten 7 Tagen einen Deal bei diesem Shop eingeloest hat.
-- Wird aufgerufen vom /api/arena/status-Endpoint.

create or replace function public.arena_eligibility(p_crew_id uuid, p_business_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_last timestamptz;
begin
  select max(dr.verified_at) into v_last
  from public.deal_redemptions dr
  join public.users u on u.id = dr.user_id
  where u.current_crew_id = p_crew_id
    and dr.business_id = p_business_id
    and dr.status = 'verified'
    and dr.verified_at > (now() - interval '7 days');

  return jsonb_build_object(
    'eligible', v_last is not null,
    'last_redemption_at', v_last,
    'expires_at', case when v_last is not null then v_last + interval '7 days' else null end
  );
end $$;
