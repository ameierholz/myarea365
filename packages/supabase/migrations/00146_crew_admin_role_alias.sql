-- ════════════════════════════════════════════════════════════════════
-- 'admin' als Synonym für 'leader'/'officer' bei Crew-Permissions
-- ════════════════════════════════════════════════════════════════════
-- Bestand: in den Seeds tauchen drei Rollen auf — leader, officer, admin.
-- Code in 00141/00142 hat nur leader+officer geprüft → admin-Mitglieder
-- konnten weder Crew-Farbe setzen noch Repeater zerstören.
-- Fix: Helper-Funktion _is_crew_officer_role(role) gilt als Single-Source-of-Truth,
-- alle existierenden Permission-RPCs nutzen sie.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._is_crew_officer_role(p_role text)
returns boolean language sql immutable as $$
  select p_role in ('leader', 'officer', 'admin');
$$;

-- ─── set_crew_territory_color: nutzt jetzt Helper ─────────────────────
create or replace function public.set_crew_territory_color(p_color text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_color', 'hint', 'Format: #RRGGBB');
  end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members
   where user_id = v_user limit 1;

  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden',
      'hint', 'Nur Leader, Officer oder Admin');
  end if;

  update public.crews set territory_color = p_color where id = v_crew;
  return jsonb_build_object('ok', true, 'color', p_color);
end $$;
grant execute on function public.set_crew_territory_color(text) to authenticated;

-- ─── destroy_own_crew_repeater: nutzt jetzt Helper ────────────────────
create or replace function public.destroy_own_crew_repeater(p_repeater_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_repeater record;
  v_stats record;
  v_refund_gold int;
  v_refund_wood int;
  v_refund_stone int;
  v_other_count int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members
   where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden',
      'hint', 'Nur Crew-Gründer, Stellvertreter oder Admin dürfen Repeater zerstören');
  end if;

  select id, crew_id, kind, max_hp, lat, lng
    into v_repeater
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   for update;
  if v_repeater is null then
    return jsonb_build_object('ok', false, 'error', 'repeater_not_found');
  end if;
  if v_repeater.crew_id <> v_crew then
    return jsonb_build_object('ok', false, 'error', 'not_own_crew');
  end if;

  if v_repeater.kind = 'hq' then
    select count(*) into v_other_count
      from public.crew_repeaters
     where crew_id = v_crew
       and destroyed_at is null
       and id <> v_repeater.id;
    if v_other_count > 0 then
      return jsonb_build_object('ok', false, 'error', 'hq_has_dependents',
        'hint', 'Erst alle anderen Repeater zerstören, dann HQ',
        'dependent_count', v_other_count);
    end if;
  end if;

  select * into v_stats from public._repeater_kind_stats(v_repeater.kind);
  v_refund_gold  := (v_stats.cost_gold  * 0.5)::int;
  v_refund_wood  := (v_stats.cost_wood  * 0.5)::int;
  v_refund_stone := (v_stats.cost_stone * 0.5)::int;

  insert into public.user_resources (user_id, gold, wood, stone)
       values (v_user, v_refund_gold, v_refund_wood, v_refund_stone)
  on conflict (user_id) do update set
    gold  = public.user_resources.gold  + excluded.gold,
    wood  = public.user_resources.wood  + excluded.wood,
    stone = public.user_resources.stone + excluded.stone;

  update public.crew_repeaters
     set destroyed_at = now(),
         hp = 0
   where id = v_repeater.id;

  return jsonb_build_object(
    'ok', true,
    'repeater_id', v_repeater.id,
    'kind', v_repeater.kind,
    'refund', jsonb_build_object(
      'gold', v_refund_gold,
      'wood', v_refund_wood,
      'stone', v_refund_stone
    )
  );
end $$;
grant execute on function public.destroy_own_crew_repeater(uuid) to authenticated;
