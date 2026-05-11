-- 00347_admin_recipient_filters.sql
-- Helper für Bulk-Inbox-Gifts: resolved user_ids nach Filter.
-- Modes:
--   - all:   alle aktiven, nicht-banned User
--   - city:  home_city_slug = p_city_slug
--   - ids:   explizite user_ids (passthrough)
--
-- Server-Filter ausgespart — City-Server-Schema noch nicht implementiert.
-- Sobald `player_server_assignment` o.ä. existiert, hier um `server` Mode
-- erweitern.

CREATE OR REPLACE FUNCTION public.admin_resolve_recipients(
  p_mode text,                    -- 'all' | 'city' | 'ids'
  p_city_slug text DEFAULT NULL,
  p_ids uuid[]     DEFAULT NULL
) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_ids uuid[];
begin
  if v_caller is null then raise exception 'unauthorized'; end if;
  select role::text into v_caller_role from public.users where id = v_caller;
  if v_caller_role not in ('admin','super_admin') then
    raise exception 'forbidden_admin_only';
  end if;

  case p_mode
    when 'all' then
      select array_agg(id) into v_ids
        from public.users
       where coalesce(is_banned, false) = false;
    when 'city' then
      if p_city_slug is null then raise exception 'city_slug_required'; end if;
      select array_agg(id) into v_ids
        from public.users
       where coalesce(is_banned, false) = false
         and home_city_slug = p_city_slug;
    when 'ids' then
      if p_ids is null then raise exception 'ids_required'; end if;
      select array_agg(id) into v_ids
        from public.users
       where coalesce(is_banned, false) = false
         and id = any(p_ids);
    else
      raise exception 'unknown_mode: %', p_mode;
  end case;

  return coalesce(v_ids, ARRAY[]::uuid[]);
end $$;

REVOKE ALL ON FUNCTION public.admin_resolve_recipients(text, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_resolve_recipients(text, text, uuid[]) TO authenticated;

-- Convenience-Count für Dry-Run / Preview
CREATE OR REPLACE FUNCTION public.admin_count_recipients(
  p_mode text,
  p_city_slug text DEFAULT NULL,
  p_ids uuid[]     DEFAULT NULL
) RETURNS int LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cardinality(public.admin_resolve_recipients(p_mode, p_city_slug, p_ids));
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_recipients(text, text, uuid[]) TO authenticated;
