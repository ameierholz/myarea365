-- Erlaubt es, die PLZ der eigenen Base nach Reverse-Geocoding zu aktualisieren.
create or replace function public.set_base_plz(p_plz text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
  v_plz  text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_plz := nullif(trim(p_plz), '');
  if v_plz is null then return jsonb_build_object('ok', false, 'error', 'empty_plz'); end if;
  -- nur Ziffern, max 10 Zeichen (international: DE 5, AT 4, CH 4, NL 4 + 2 Buchstaben)
  if length(v_plz) > 10 or v_plz !~ '^[0-9A-Za-z\s\-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_plz');
  end if;
  select id into v_id from public.bases where owner_user_id = v_user;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
  update public.bases set plz = v_plz, updated_at = now() where id = v_id;
  return jsonb_build_object('ok', true, 'plz', v_plz);
end $$;

revoke all on function public.set_base_plz(text) from public;
grant execute on function public.set_base_plz(text) to authenticated;
