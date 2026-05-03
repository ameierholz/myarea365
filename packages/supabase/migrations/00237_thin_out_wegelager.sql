-- ─── 00237: Wegelager-Dichte auf ~33% reduzieren ─────────────────────
-- User-Feedback: 1775 aktive Wegelager Berlin-weit (1 pro city_block ≥500 m²)
-- fühlt sich an wie ein "Minenfeld". Ziel: ~33% behalten — natürlicher
-- Welt-Pattern, ~250-400m Abstand statt 150-300m.
--
-- Methode: deterministisches Hash-Sampling auf id (md5 → erste Hex-Stelle 0-4
-- behalten = ~31%). Vorteil ggü. random(): idempotent + reproduzierbar bei
-- Re-Run.

with kept as (
  select id from public.strongholds
   where defeated_at is null
     and substr(md5(id::text), 1, 1) in ('0','1','2','3','4')
)
delete from public.rallies r
 where r.stronghold_id in (
   select id from public.strongholds
    where defeated_at is null
      and id not in (select id from kept)
 ) and r.status in ('preparing', 'marching');

delete from public.strongholds
 where defeated_at is null
   and substr(md5(id::text), 1, 1) not in ('0','1','2','3','4');
