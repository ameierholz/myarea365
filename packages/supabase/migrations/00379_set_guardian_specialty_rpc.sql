-- 00379_set_guardian_specialty_rpc.sql
-- Setzt das weather_specialty-Tag eines Wächters. Catalog: guardian_weather_specialties.
create or replace function public.set_guardian_specialty(p_guardian_id uuid, p_code text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_valid boolean := false;
  v_owns boolean := false;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_code is not null then
    select exists(select 1 from public.guardian_weather_specialties where code = p_code) into v_valid;
    if not v_valid then return jsonb_build_object('ok', false, 'error', 'invalid_specialty'); end if;
  end if;
  select exists(select 1 from public.user_guardians where id = p_guardian_id and user_id = v_user) into v_owns;
  if not v_owns then return jsonb_build_object('ok', false, 'error', 'guardian_not_owned'); end if;
  update public.user_guardians set weather_specialty = p_code where id = p_guardian_id and user_id = v_user;
  return jsonb_build_object('ok', true, 'specialty', p_code);
end $$;
grant execute on function public.set_guardian_specialty(uuid, text) to authenticated;
