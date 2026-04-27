-- ══════════════════════════════════════════════════════════════════════════
-- Strongholds: Dichte erhöhen — 15 pro Region statt 5, größere Streuung
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.spawn_strongholds_for_plz(p_plz text, p_center_lat double precision, p_center_lng double precision)
returns int language plpgsql security definer as $$
declare
  v_active int;
  v_to_spawn int;
  v_jitter_lat double precision;
  v_jitter_lng double precision;
  v_lvl int;
  v_hp bigint;
  i int;
begin
  select count(*) into v_active from public.strongholds
   where plz = p_plz and defeated_at is null;
  v_to_spawn := greatest(0, 15 - v_active);
  for i in 1..v_to_spawn loop
    -- Größerer Jitter ±0.04° (~4 km) → bessere Verteilung über die Karte
    v_jitter_lat := (random() - 0.5) * 0.08;
    v_jitter_lng := (random() - 0.5) * 0.08;
    v_lvl := 1 + floor(random() * 10)::int;
    v_hp := public.stronghold_hp_for_level(v_lvl);
    insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
    values (p_plz, p_center_lat + v_jitter_lat, p_center_lng + v_jitter_lng, v_lvl, v_hp, v_hp);
  end loop;
  return v_to_spawn;
end $$;
