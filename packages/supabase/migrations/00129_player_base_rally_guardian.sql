-- ════════════════════════════════════════════════════════════════════
-- PLAYER-BASE-RALLY — Wächter-Kommandant (Guardian-Boost)
-- ════════════════════════════════════════════════════════════════════
-- Erlaubt dem Rally-Leader einen aktiven Wächter mitzuschicken. Wächter
-- gibt einen ATK-Bonus von level × 5% (max 100%). Wächter-ID wird
-- gespeichert für Inbox-Reports & Banner-Anzeige.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Spalte für Guardian-Kommandant ───────────────────────────────
alter table public.player_base_rallies
  add column if not exists guardian_user_guardian_id uuid references public.user_guardians(id) on delete set null,
  add column if not exists guardian_bonus_pct numeric not null default 0;

-- ─── 2) start_player_base_rally — neue Signatur mit guardian-id ─────
-- Drop alte Variante (3 args) zuerst, damit kein Overload-Konflikt entsteht
drop function if exists public.start_player_base_rally(uuid, int, jsonb);

create or replace function public.start_player_base_rally(
  p_defender_user_id uuid,
  p_prep_seconds     int,
  p_troops           jsonb,
  p_guardian_id      uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user        uuid := auth.uid();
  v_crew        uuid;
  v_def_base    record;
  v_atk         bigint;
  v_rally_id    uuid;
  v_g_level     int := 0;
  v_bonus_pct   numeric := 0;
  v_bonus_atk   bigint := 0;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_attack_self'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select * into v_def_base from public.bases where owner_user_id = p_defender_user_id;
  if v_def_base is null then return jsonb_build_object('ok', false, 'error', 'defender_no_base'); end if;
  if v_def_base.shield_until is not null and v_def_base.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'defender_shielded');
  end if;

  if exists (
    select 1 from public.player_base_rallies
     where crew_id = v_crew and status in ('preparing','marching','fighting')
  ) then
    return jsonb_build_object('ok', false, 'error', 'crew_rally_already_active');
  end if;

  -- Wächter validieren (muss dem User gehören, aktiv sein)
  if p_guardian_id is not null then
    select level into v_g_level
      from public.user_guardians
     where id = p_guardian_id and user_id = v_user and is_active = true;
    if v_g_level is null then
      return jsonb_build_object('ok', false, 'error', 'guardian_not_owned_or_inactive');
    end if;
    v_bonus_pct := least(100, v_g_level * 5);
  end if;

  -- Truppen sperren
  begin
    v_atk := public._reserve_user_troops(v_user, p_troops);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  -- Bonus auf total_atk anwenden
  v_bonus_atk := (v_atk * v_bonus_pct / 100)::bigint;

  insert into public.player_base_rallies (
    leader_user_id, crew_id, defender_user_id,
    defender_lat, defender_lng,
    prep_seconds, prep_ends_at, total_atk,
    guardian_user_guardian_id, guardian_bonus_pct
  ) values (
    v_user, v_crew, p_defender_user_id,
    v_def_base.lat, v_def_base.lng,
    p_prep_seconds, now() + (p_prep_seconds || ' seconds')::interval,
    v_atk + v_bonus_atk,
    p_guardian_id, v_bonus_pct
  ) returning id into v_rally_id;

  insert into public.player_base_rally_participants (rally_id, user_id, troops, atk_contribution)
  values (v_rally_id, v_user, p_troops, v_atk + v_bonus_atk);

  return jsonb_build_object(
    'ok', true,
    'rally_id', v_rally_id,
    'prep_ends_at', (now() + (p_prep_seconds || ' seconds')::interval),
    'atk', v_atk,
    'guardian_bonus_pct', v_bonus_pct,
    'bonus_atk', v_bonus_atk
  );
end $$;

revoke all on function public.start_player_base_rally(uuid, int, jsonb, uuid) from public;
grant execute on function public.start_player_base_rally(uuid, int, jsonb, uuid) to authenticated;
