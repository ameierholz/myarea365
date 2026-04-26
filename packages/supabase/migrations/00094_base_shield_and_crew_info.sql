-- ══════════════════════════════════════════════════════════════════════════
-- BASE-SCHUTZSCHILD + CREW-INFO IN PUBLIC-VIEW
-- ══════════════════════════════════════════════════════════════════════════
-- - bases bekommen shield_until / shield_last_activated_at
-- - private = nur via Schutzschild aktivierbar (kostet 500 Gold, 24h aktiv,
--   7-Tage-Cooldown). set_base_visibility('private') wird abgelehnt.
-- - get_base_public liefert jetzt auch Crew-Info (id, name, color)
-- - get_base_public behandelt abgelaufenen Schild automatisch als public
-- ══════════════════════════════════════════════════════════════════════════

alter table public.bases
  add column if not exists shield_until              timestamptz,
  add column if not exists shield_last_activated_at  timestamptz;

-- ─── set_base_visibility: kein direktes 'private' mehr ─────────────────────
create or replace function public.set_base_visibility(p_visibility text)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_visibility not in ('public', 'crew') then
    return jsonb_build_object('ok', false, 'error', 'invalid_visibility',
      'hint', 'private nur via activate_base_shield()');
  end if;
  update public.bases set visibility = p_visibility, updated_at = now()
   where owner_user_id = v_user;
  return jsonb_build_object('ok', true, 'visibility', p_visibility);
end $$;

revoke all on function public.set_base_visibility(text) from public;
grant execute on function public.set_base_visibility(text) to authenticated;

-- ─── activate_base_shield(): kostet Gold, 24h aktiv, 7-Tage-Cooldown ───────
create or replace function public.activate_base_shield()
returns jsonb language plpgsql security definer as $$
declare
  v_user      uuid := auth.uid();
  v_base      record;
  v_cost      int := 500;
  v_cooldown  interval := interval '7 days';
  v_remaining int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_base from public.bases where owner_user_id = v_user;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
  if v_base.shield_until is not null and v_base.shield_until > now() then
    v_remaining := extract(epoch from (v_base.shield_until - now()))::int;
    return jsonb_build_object('ok', false, 'error', 'already_active', 'remaining_seconds', v_remaining);
  end if;
  if v_base.shield_last_activated_at is not null
     and v_base.shield_last_activated_at + v_cooldown > now() then
    v_remaining := extract(epoch from ((v_base.shield_last_activated_at + v_cooldown) - now()))::int;
    return jsonb_build_object('ok', false, 'error', 'cooldown_active', 'remaining_seconds', v_remaining);
  end if;

  -- Gold abziehen
  update public.user_resources set gold = gold - v_cost, updated_at = now()
   where user_id = v_user and gold >= v_cost;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'cost', v_cost);
  end if;

  update public.bases set
    visibility               = 'private',
    shield_until             = now() + interval '24 hours',
    shield_last_activated_at = now(),
    updated_at               = now()
   where id = v_base.id;

  return jsonb_build_object('ok', true,
    'shield_until', (now() + interval '24 hours'),
    'cost_gold', v_cost,
    'cooldown_seconds', extract(epoch from v_cooldown)::int);
end $$;

revoke all on function public.activate_base_shield() from public;
grant execute on function public.activate_base_shield() to authenticated;

-- ─── deactivate_base_shield(): manuell beenden (optional) ──────────────────
create or replace function public.deactivate_base_shield()
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.bases set
    visibility   = 'public',
    shield_until = null,
    updated_at   = now()
   where owner_user_id = v_user;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.deactivate_base_shield() from public;
grant execute on function public.deactivate_base_shield() to authenticated;

-- ─── get_base_public erweitert: Crew-Info + abgelaufenen Schild handhaben ─
create or replace function public.get_base_public(p_base_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_base       record;
  v_buildings  jsonb;
  v_owner      record;
  v_crew       record;
  v_eff_vis    text;
begin
  select * into v_base from public.bases where id = p_base_id;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- effektive Sichtbarkeit: abgelaufener Schild → public
  v_eff_vis := v_base.visibility;
  if v_eff_vis = 'private' and (v_base.shield_until is null or v_base.shield_until <= now()) then
    v_eff_vis := 'public';
  end if;

  if v_eff_vis = 'private' and v_base.owner_user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'private',
      'shield_until', v_base.shield_until);
  end if;
  if v_eff_vis = 'crew' and v_base.owner_user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    if not exists (
      select 1 from public.crew_members me, public.crew_members other
      where me.user_id = auth.uid()
        and other.user_id = v_base.owner_user_id
        and me.crew_id = other.crew_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'crew_only');
    end if;
  end if;

  select jsonb_agg(jsonb_build_object(
    'building_id', bb.building_id, 'level', bb.level,
    'name', bc.name, 'emoji', bc.emoji
  )) into v_buildings
  from public.base_buildings bb
  join public.buildings_catalog bc on bc.id = bb.building_id
  where bb.base_id = p_base_id;

  select display_name, avatar_url into v_owner
    from public.users where id = v_base.owner_user_id;

  -- Crew des Owners (falls in einer Crew)
  select c.id, c.name, c.color into v_crew
    from public.crew_members cm
    join public.crews c on c.id = cm.crew_id
   where cm.user_id = v_base.owner_user_id
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'base', jsonb_build_object(
      'id', v_base.id, 'level', v_base.level, 'plz', v_base.plz,
      'theme_id', v_base.theme_id, 'pin_label', v_base.pin_label,
      'lat', v_base.lat, 'lng', v_base.lng,
      'visibility', v_eff_vis,
      'shield_until', case when v_base.owner_user_id = auth.uid() then v_base.shield_until else null end
    ),
    'owner', jsonb_build_object('display_name', v_owner.display_name, 'avatar_url', v_owner.avatar_url),
    'crew',  case when v_crew is null then null else
              jsonb_build_object('id', v_crew.id, 'name', v_crew.name, 'color', v_crew.color)
             end,
    'buildings', coalesce(v_buildings, '[]'::jsonb)
  );
end $$;

revoke all on function public.get_base_public(uuid) from public;
grant execute on function public.get_base_public(uuid) to anon, authenticated;

-- ─── get_base_shield_status(): UI-Helper ───────────────────────────────────
create or replace function public.get_base_shield_status()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base record;
  v_active boolean := false;
  v_remaining int := 0;
  v_cooldown_remaining int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_base from public.bases where owner_user_id = v_user;
  if v_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
  if v_base.shield_until is not null and v_base.shield_until > now() then
    v_active := true;
    v_remaining := extract(epoch from (v_base.shield_until - now()))::int;
  end if;
  if v_base.shield_last_activated_at is not null then
    v_cooldown_remaining := greatest(0, extract(epoch from
      ((v_base.shield_last_activated_at + interval '7 days') - now()))::int);
  end if;
  return jsonb_build_object('ok', true,
    'active', v_active,
    'remaining_seconds', v_remaining,
    'cooldown_remaining_seconds', v_cooldown_remaining,
    'cost_gold', 500,
    'duration_hours', 24);
end $$;

revoke all on function public.get_base_shield_status() from public;
grant execute on function public.get_base_shield_status() to authenticated;
