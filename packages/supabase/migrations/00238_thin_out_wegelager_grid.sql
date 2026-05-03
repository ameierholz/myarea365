-- ─── 00238: Wegelager — Mindestabstand via Grid-Bucketing ─────────────
-- 00237 hat zwar von 1775 → 541 reduziert, aber random Sampling lässt
-- weiterhin Cluster zu (mehrere im selben Block-Cluster).
--
-- Hier: Grid-Bucket mit ~330m Kantenlänge (lat 0.003° ≈ 333m, lng 0.0045°
-- ≈ 320m bei 52°N). Pro Zelle nur das stronghold mit niedrigster id.
-- Ergebnis: ~297 Wegelager Berlin-weit, garantierter Mindestabstand.

with grid as (
  select id,
         row_number() over (
           partition by floor(lat/0.003), floor(lng/0.0045)
           order by id
         ) as rn
  from public.strongholds
  where defeated_at is null
),
loser as (select id from grid where rn > 1)
delete from public.rallies r
 where r.stronghold_id in (select id from loser)
   and r.status in ('preparing','marching');

with grid as (
  select id,
         row_number() over (
           partition by floor(lat/0.003), floor(lng/0.0045)
           order by id
         ) as rn
  from public.strongholds
  where defeated_at is null
)
delete from public.strongholds where id in (select id from grid where rn > 1);
