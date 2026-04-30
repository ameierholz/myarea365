-- ══════════════════════════════════════════════════════════════════════════
-- Wegelager: Welt-Content statt Spieler-getriggert
-- ══════════════════════════════════════════════════════════════════════════
-- Konzept: Wegelager sind statisch in der Welt platziert (1 pro city_block),
-- nicht mehr durch Spieler-Bewegung getriggert. Defeated → Respawn an
-- gleicher Position (vorhandene respawn_due_strongholds-Logik).
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Tabula rasa: alle alten Wegelager + offene Rallies entfernen.
--    Die alten waren über random Jitter platziert (oft im Wasser/Wald),
--    daher Reset.
delete from public.rallies where status in ('preparing', 'marching');
delete from public.strongholds;

-- 2) Pre-Seed: ein Wegelager pro Berlin-city_block am Centroid mit ±30m Jitter.
--    1978 Blocks → 1978 Wegelager Berlin-weit, naturgemäß ~150m bis 300m
--    voneinander entfernt (Avg-Block ~14600 m² ≈ 120m × 120m).
insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
select
  'block_' || cb.id::text                                  as plz,
  -- Jitter ±0.0003° (~30m) damit nicht alle exakt am math. Centroid hängen
  st_y(cb.centroid) + (random() - 0.5) * 0.0006            as lat,
  st_x(cb.centroid) + (random() - 0.5) * 0.0006            as lng,
  -- Level-Verteilung: 1-10, leicht in Richtung 3-7 gewichtet
  greatest(1, least(10, 1 + floor(random() * 10)::int))    as level,
  public.stronghold_hp_for_level(
    greatest(1, least(10, 1 + floor(random() * 10)::int))
  )                                                        as total_hp,
  public.stronghold_hp_for_level(
    greatest(1, least(10, 1 + floor(random() * 10)::int))
  )                                                        as current_hp
from public.city_blocks cb
where cb.city = 'berlin'
  and cb.centroid is not null
  -- Nur urbane Blocks (≥500 m²) — Mini-Verkehrsinseln raus
  and cb.area_m2 >= 500;

-- 3) Spawn-Funktion zur No-Op machen — Frontend könnte sie noch aufrufen,
--    soll aber keine Wegelager mehr erzeugen. Welt-Population ist statisch.
create or replace function public.spawn_strongholds_for_plz(
  p_plz text, p_center_lat double precision, p_center_lng double precision
)
returns int language plpgsql security definer as $$
begin
  -- No-Op: Wegelager sind statisch pre-seeded. Respawn übernimmt
  -- respawn_due_strongholds() (gleiche Position, kein neuer Spawn).
  -- Argumente bewusst ungenutzt, Signatur bleibt für Backwards-Compat.
  perform p_plz, p_center_lat, p_center_lng;
  return 0;
end $$;

-- 4) TTL hochsetzen: 48 h war für „nutzergetriggerte" Welt sinnvoll, jetzt
--    aber unerwünscht (Welt soll stabil bleiben). 30 Tage = quasi-aus.
create or replace function public.expire_old_strongholds()
returns int language plpgsql security definer as $$
declare v_count int;
begin
  with expired as (
    update public.strongholds
       set defeated_at = now(),
           respawn_at  = now() + (60 + floor(random() * 301))::int * interval '1 minute'
     where defeated_at is null
       and spawned_at < now() - interval '30 days'
    returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end $$;
