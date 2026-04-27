-- ══════════════════════════════════════════════════════════════════════════
-- Berlin-Launch-Seed: Wegelager über die ganze Stadt verteilen
-- ══════════════════════════════════════════════════════════════════════════
-- Berlin-BBox ≈ 52.34–52.68 N, 13.09–13.76 E (~45 km × 38 km).
-- Grid 0.022° lat × 0.034° lng ≈ 2.5 km Zellen → ~285 Zellen.
-- Pro Zelle 1 Wegelager mit Jitter ±50% innerhalb der Zelle, zufälliges Lvl 1–10.
-- Idempotent: skipped wenn schon ≥ 200 Wegelager mit plz='BERLIN' existieren.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.seed_berlin_strongholds()
returns int language plpgsql security definer as $$
declare
  v_existing int;
  v_inserted int := 0;
  v_lat double precision;
  v_lng double precision;
  v_step_lat constant double precision := 0.022;
  v_step_lng constant double precision := 0.034;
  v_south  constant double precision := 52.340;
  v_north  constant double precision := 52.680;
  v_west   constant double precision := 13.090;
  v_east   constant double precision := 13.760;
  v_jit_lat double precision;
  v_jit_lng double precision;
  v_lvl int;
  v_hp bigint;
begin
  select count(*) into v_existing from public.strongholds
   where plz = 'BERLIN' and defeated_at is null;
  if v_existing >= 200 then
    return 0;
  end if;

  v_lat := v_south;
  while v_lat <= v_north loop
    v_lng := v_west;
    while v_lng <= v_east loop
      v_jit_lat := (random() - 0.5) * v_step_lat;     -- ±50% innerhalb Zelle
      v_jit_lng := (random() - 0.5) * v_step_lng;
      v_lvl := 1 + floor(random() * 10)::int;
      v_hp := public.stronghold_hp_for_level(v_lvl);
      insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
      values ('BERLIN', v_lat + v_jit_lat, v_lng + v_jit_lng, v_lvl, v_hp, v_hp);
      v_inserted := v_inserted + 1;
      v_lng := v_lng + v_step_lng;
    end loop;
    v_lat := v_lat + v_step_lat;
  end loop;
  return v_inserted;
end $$;
revoke all on function public.seed_berlin_strongholds() from public;
grant execute on function public.seed_berlin_strongholds() to authenticated;

-- Direkt ausführen (idempotent durch Count-Check)
select public.seed_berlin_strongholds();
