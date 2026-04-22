-- 00034: Fix für arena_season_pick_guardian
-- Problem: idx_user_guardian_active (unique where is_active) kollidiert, weil die alte
-- RPC erst den neuen seasonal-Wächter mit is_active=true einfügt und ERST DANACH
-- die anderen deaktiviert. Wir drehen die Reihenfolge um.

create or replace function public.arena_season_pick_guardian(
  p_user_id      uuid,
  p_archetype_id text
) returns uuid language plpgsql security definer as $$
declare
  v_season_id uuid := public.current_season_id();
  v_new_id    uuid;
begin
  if v_season_id is null then
    raise exception 'Keine aktive Saison';
  end if;

  -- Bereits gepickt?
  if exists (
    select 1 from public.user_guardians
     where user_id = p_user_id and kind = 'seasonal' and season_id = v_season_id
  ) then
    raise exception 'Saison-Wächter bereits gewählt';
  end if;

  -- 1) ZUERST alle aktiven Wächter des Users deaktivieren (wegen unique idx on is_active)
  update public.user_guardians
     set is_active = false
   where user_id = p_user_id and is_active;

  -- 2) JETZT neuen Saison-Wächter als aktiv einfügen
  insert into public.user_guardians (
    user_id, archetype_id, kind, season_id, is_active,
    level, xp, wins, losses, current_hp_pct,
    talent_points_available, talent_points_spent
  ) values (
    p_user_id, p_archetype_id, 'seasonal', v_season_id, true,
    1, 0, 0, 0, 100,
    0, 0
  ) returning id into v_new_id;

  return v_new_id;
end $$;
